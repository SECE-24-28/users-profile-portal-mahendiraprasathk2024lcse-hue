import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { generateToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

type GraphQLUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

type GraphQLContext = {
  user: GraphQLUser | null;
};

type StudentArgs = {
  name: string;
  email: string;
  department: string;
  profileImage?: string | null;
};

type UpdateStudentArgs = StudentArgs & {
  id: string;
};

type RegisterArgs = {
  username: string;
  email: string;
  password: string;
  role?: string | null;
};

type LoginArgs = {
  email: string;
  password: string;
};

const uploadsDirectory = path.join(process.cwd(), "public", "uploads");

const parseStudentId = (id: string | number) => {
  const studentId = Number(id);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new GraphQLError("Invalid student ID.");
  }

  return studentId;
};

const requireUser = (context: GraphQLContext) => {
  if (!context.user) {
    throw new GraphQLError("Unauthorized.");
  }

  return context.user;
};

const deleteStoredImage = async (imagePath?: string | null) => {
  if (!imagePath || !imagePath.startsWith("/uploads/")) {
    return;
  }

  const absolutePath = path.join(process.cwd(), "public", imagePath.replace(/^\/+/, ""));

  try {
    await unlink(absolutePath);
  } catch {
    return;
  }
};

const saveUploadedImage = async (imageData?: string | null) => {
  if (!imageData) {
    return null;
  }

  const uploadMatch = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!uploadMatch) {
    if (imageData.startsWith("/uploads/")) {
      return imageData;
    }

    throw new GraphQLError("Invalid image upload format.");
  }

  const mimeType = uploadMatch[1];
  const base64Content = uploadMatch[2];
  const extension = mimeType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = `/uploads/${fileName}`;

  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(path.join(uploadsDirectory, fileName), Buffer.from(base64Content, "base64"));

  return relativePath;
};

const mapPrismaError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof GraphQLError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new GraphQLError("Student not found.");
  }

  throw new GraphQLError(fallbackMessage);
};

export const resolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      try {
        const user = requireUser(context);

        return await prisma.user.findUnique({
          where: {
            id: user.id,
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        });
      } catch (error) {
        mapPrismaError(error, "Failed to fetch current user.");
      }
    },

    students: async () => {
      try {
        return await prisma.student.findMany({
          orderBy: {
            createdAt: "desc",
          },
        });
      } catch (error) {
        mapPrismaError(error, "Failed to fetch students.");
      }
    },

    student: async (_parent: unknown, args: { id: string }) => {
      try {
        const studentId = parseStudentId(args.id);

        const student = await prisma.student.findUnique({
          where: {
            id: studentId,
          },
        });

        if (!student) {
          throw new GraphQLError("Student not found.");
        }

        return student;
      } catch (error) {
        mapPrismaError(error, "Failed to fetch student.");
      }
    },
  },

  Mutation: {
    register: async (_parent: unknown, args: RegisterArgs) => {
      try {
        const hashedPassword = await bcrypt.hash(args.password, 10);

        const user = await prisma.user.create({
          data: {
            username: args.username,
            email: args.email,
            password: hashedPassword,
            role: args.role ?? "USER",
          },
        });

        return generateToken(user.id);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new GraphQLError("A user with this email already exists.");
        }

        mapPrismaError(error, "Failed to register user.");
      }
    },

    login: async (_parent: unknown, args: LoginArgs) => {
      try {
        const user = await prisma.user.findUnique({
          where: {
            email: args.email,
          },
        });

        if (!user) {
          throw new GraphQLError("Invalid email or password.");
        }

        const isPasswordValid = await bcrypt.compare(args.password, user.password);

        if (!isPasswordValid) {
          throw new GraphQLError("Invalid email or password.");
        }

        return generateToken(user.id);
      } catch (error) {
        mapPrismaError(error, "Failed to login user.");
      }
    },

    addStudent: async (_parent: unknown, args: StudentArgs, context: GraphQLContext) => {
      try {
        requireUser(context);

        const storedImagePath = await saveUploadedImage(args.profileImage);

        return await prisma.student.create({
          data: {
            name: args.name,
            email: args.email,
            department: args.department,
            profileImage: storedImagePath,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new GraphQLError("A student with this email already exists.");
        }

        mapPrismaError(error, "Failed to add student.");
      }
    },

    updateStudent: async (_parent: unknown, args: UpdateStudentArgs, context: GraphQLContext) => {
      let storedImagePath: string | null | undefined = undefined;
      let existingImagePath: string | null = null;

      try {
        requireUser(context);

        const studentId = parseStudentId(args.id);

        const existingStudent = await prisma.student.findUnique({
          where: {
            id: studentId,
          },
        });

        if (!existingStudent) {
          throw new GraphQLError("Student not found.");
        }

        let shouldDeleteOldImage = false;
        existingImagePath = existingStudent.profileImage;

        if (args.profileImage) {
          storedImagePath = await saveUploadedImage(args.profileImage);
          shouldDeleteOldImage = Boolean(existingImagePath && storedImagePath !== existingImagePath);
        }

        if (args.email && args.email !== existingStudent.email) {
          const duplicateStudent = await prisma.student.findUnique({
            where: {
              email: args.email,
            },
          });

          if (duplicateStudent && duplicateStudent.id !== studentId) {
            throw new GraphQLError("A student with this email already exists.");
          }
        }

        const updatedStudent = await prisma.student.update({
          where: {
            id: studentId,
          },
          data: {
            name: args.name ?? undefined,
            email: args.email ?? undefined,
            department: args.department ?? undefined,
            profileImage: storedImagePath ?? undefined,
          },
        });

        if (shouldDeleteOldImage) {
          await deleteStoredImage(existingImagePath);
        }

        return updatedStudent;
      } catch (error) {
        if (storedImagePath && storedImagePath !== existingImagePath) {
          await deleteStoredImage(storedImagePath);
        }

        mapPrismaError(error, "Failed to update student.");
      }
    },

    deleteStudent: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      try {
        requireUser(context);

        const studentId = parseStudentId(args.id);

        const existingStudent = await prisma.student.findUnique({
          where: {
            id: studentId,
          },
        });

        if (!existingStudent) {
          throw new GraphQLError("Student not found.");
        }

        await prisma.student.delete({
          where: {
            id: studentId,
          },
        });

        await deleteStoredImage(existingStudent.profileImage);

        return "Student deleted successfully.";
      } catch (error) {
        mapPrismaError(error, "Failed to delete student.");
      }
    },
  },
};
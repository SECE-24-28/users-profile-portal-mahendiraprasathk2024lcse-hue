"use client";

import { ApolloClient, InMemoryCache, HttpLink, from, gql } from "@apollo/client/core";
import { ApolloProvider, useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { setContext } from "@apollo/client/link/context";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Student = {
	id: string;
	name: string;
	email: string;
	department: string;
	profileImage?: string | null;
	createdAt: string;
	updatedAt: string;
};

type AuthFormState = {
	username: string;
	email: string;
	password: string;
	role: string;
};

type StudentFormState = {
	name: string;
	email: string;
	department: string;
	profileImage: string;
};

type MeQueryResult = {
	me: {
		id: string;
		username: string;
		email: string;
		role: string;
	} | null;
};

type RegisterMutationResult = {
	register: string;
};

type LoginMutationResult = {
	login: string;
};

type AddStudentMutationResult = {
	addStudent: Student;
};

type UpdateStudentMutationResult = {
	updateStudent: Student;
};

type DeleteStudentMutationResult = {
	deleteStudent: string;
};

const TOKEN_STORAGE_KEY = "student-profile-token";

const STUDENTS_QUERY = gql`
	query Students {
		students {
			id
			name
			email
			department
			profileImage
			createdAt
			updatedAt
		}
	}
`;

const REGISTER_MUTATION = gql`
	mutation Register($username: String!, $email: String!, $password: String!, $role: String) {
		register(username: $username, email: $email, password: $password, role: $role)
	}
`;

const LOGIN_MUTATION = gql`
	mutation Login($email: String!, $password: String!) {
		login(email: $email, password: $password)
	}
`;

const ADD_STUDENT_MUTATION = gql`
	mutation AddStudent($name: String!, $email: String!, $department: String!, $profileImage: String) {
		addStudent(name: $name, email: $email, department: $department, profileImage: $profileImage) {
			id
			name
			email
			department
			profileImage
			createdAt
			updatedAt
		}
	}
`;

const UPDATE_STUDENT_MUTATION = gql`
	mutation UpdateStudent($id: ID!, $name: String, $email: String, $department: String, $profileImage: String) {
		updateStudent(id: $id, name: $name, email: $email, department: $department, profileImage: $profileImage) {
			id
			name
			email
			department
			profileImage
			createdAt
			updatedAt
		}
	}
`;

const DELETE_STUDENT_MUTATION = gql`
	mutation DeleteStudent($id: ID!) {
		deleteStudent(id: $id)
	}
`;

const AUTH_ME_QUERY = gql`
	query Me {
		me {
			id
			username
			email
			role
		}
	}
`;

const httpLink = new HttpLink({
	uri: "/api/graphql",
});

const authLink = setContext((_, previousContext) => {
	if (typeof window === "undefined") {
		return previousContext;
	}

	const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);

	return {
		headers: {
			...previousContext.headers,
			authorization: token ? `Bearer ${token}` : "",
		},
	};
});

const apolloClient = new ApolloClient({
	link: from([authLink, httpLink]),
	cache: new InMemoryCache(),
});

function StudentProfileContent() {
	const apolloClient = useApolloClient();
	const [token, setToken] = useState(() => {
		if (typeof window === "undefined") {
			return "";
		}

		return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
	});
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
	const [authForm, setAuthForm] = useState<AuthFormState>({
		username: "",
		email: "",
		password: "",
		role: "USER",
	});
	const [studentForm, setStudentForm] = useState<StudentFormState>({
		name: "",
		email: "",
		department: "",
		profileImage: "",
	});
	const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
	const [message, setMessage] = useState("");

	const { data, loading, error, refetch } = useQuery<{ students: Student[] }>(STUDENTS_QUERY);
	const { data: meData, refetch: refetchMe } = useQuery<MeQueryResult>(AUTH_ME_QUERY, {
		skip: !token,
	});

	const [registerUser, { loading: registering }] = useMutation<RegisterMutationResult>(REGISTER_MUTATION);
	const [loginUser, { loading: loggingIn }] = useMutation<LoginMutationResult>(LOGIN_MUTATION);
	const [addStudent, { loading: addingStudent }] = useMutation<AddStudentMutationResult>(ADD_STUDENT_MUTATION);
	const [updateStudent, { loading: updatingStudent }] = useMutation<UpdateStudentMutationResult>(UPDATE_STUDENT_MUTATION);
	const [deleteStudent, { loading: deletingStudent }] = useMutation<DeleteStudentMutationResult>(DELETE_STUDENT_MUTATION);

	useEffect(() => {
		if (token) {
			window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
		} else {
			window.localStorage.removeItem(TOKEN_STORAGE_KEY);
		}
	}, [token]);

	const currentUser = useMemo(() => meData?.me ?? null, [meData]);

	const resetStudentForm = () => {
		setStudentForm({
			name: "",
			email: "",
			department: "",
			profileImage: "",
		});
		setEditingStudentId(null);
	};

	const handleAuthChange = (field: keyof AuthFormState) => (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setAuthForm((current) => ({
			...current,
			[field]: event.target.value,
		}));
	};

	const handleStudentChange = (field: keyof StudentFormState) => (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setStudentForm((current) => ({
			...current,
			[field]: event.target.value,
		}));
	};

	const handleStudentImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];

		if (!file) {
			setStudentForm((current) => ({
				...current,
				profileImage: "",
			}));
			return;
		}

		const reader = new FileReader();

		reader.onload = () => {
			setStudentForm((current) => ({
				...current,
				profileImage: typeof reader.result === "string" ? reader.result : "",
			}));
		};

		reader.readAsDataURL(file);
	};

	const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");

		try {
			const result = await registerUser({
				variables: {
					username: authForm.username,
					email: authForm.email,
					password: authForm.password,
					role: authForm.role || "USER",
				},
			});

			const newToken = result.data?.register;

			if (newToken) {
				setToken(newToken);
				await apolloClient.resetStore();
				await refetchMe();
			}

			setMessage("User registered successfully.");
		} catch (mutationError) {
			setMessage(mutationError instanceof Error ? mutationError.message : "Registration failed.");
		}
	};

	const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");

		try {
			const result = await loginUser({
				variables: {
					email: authForm.email,
					password: authForm.password,
				},
			});

			const newToken = result.data?.login;

			if (newToken) {
				setToken(newToken);
				await apolloClient.resetStore();
				await refetchMe();
			}

			setMessage("User logged in successfully.");
		} catch (mutationError) {
			setMessage(mutationError instanceof Error ? mutationError.message : "Login failed.");
		}
	};

	const handleStudentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");

		try {
			const uploadedImage = studentForm.profileImage || undefined;

			if (editingStudentId) {
				const result = await updateStudent({
					variables: {
						id: editingStudentId,
						name: studentForm.name,
						email: studentForm.email,
						department: studentForm.department,
						profileImage: uploadedImage,
					},
				});

				if (result.data?.updateStudent) {
					setSelectedStudent(result.data.updateStudent);
				}

				setMessage("Student updated successfully.");
			} else {
				const result = await addStudent({
					variables: {
						name: studentForm.name,
						email: studentForm.email,
						department: studentForm.department,
						profileImage: uploadedImage,
					},
				});

				if (result.data?.addStudent) {
					setSelectedStudent(result.data.addStudent);
				}

				setMessage("Student added successfully.");
			}

			resetStudentForm();
			await refetch();
			await refetchMe();
		} catch (mutationError) {
			setMessage(mutationError instanceof Error ? mutationError.message : "Student save failed.");
		}
	};

	const handleEditStudent = (student: Student) => {
		setEditingStudentId(student.id);
		setSelectedStudent(student);
		setStudentForm({
			name: student.name,
			email: student.email,
			department: student.department,
			profileImage: "",
		});
		setMessage("");
	};

	const handleViewStudent = (student: Student) => {
		setSelectedStudent(student);
		setMessage("");
	};

	const handleDeleteStudent = async (studentId: string) => {
		setMessage("");

		try {
			await deleteStudent({
				variables: {
					id: studentId,
				},
			});

			if (editingStudentId === studentId) {
				resetStudentForm();
			}

			if (selectedStudent?.id === studentId) {
				setSelectedStudent(null);
			}

			setMessage("Student deleted successfully.");
			await refetch();
			await refetchMe();
		} catch (mutationError) {
			setMessage(mutationError instanceof Error ? mutationError.message : "Delete failed.");
		}
	};

	const handleLogout = async () => {
		setToken("");
		setMessage("Logged out.");
		await apolloClient.clearStore();
		await refetch();
	};

	return (
		<main>
			<section>
				<h1>Student Profile Page</h1>
				<p>Use the form below to add, edit, and delete students.</p>
			</section>

			<section>
				<h2>Authentication</h2>
				<form onSubmit={authMode === "login" ? handleLogin : handleRegister}>
					{authMode === "register" ? (
						<div>
							<label htmlFor="username">Username</label>
							<input
								id="username"
								value={authForm.username}
								onChange={handleAuthChange("username")}
								type="text"
							/>
						</div>
					) : null}

					<div>
						<label htmlFor="authEmail">Email</label>
						<input
							id="authEmail"
							value={authForm.email}
							onChange={handleAuthChange("email")}
							type="email"
						/>
					</div>

					<div>
						<label htmlFor="authPassword">Password</label>
						<input
							id="authPassword"
							value={authForm.password}
							onChange={handleAuthChange("password")}
							type="password"
						/>
					</div>

					{authMode === "register" ? (
						<div>
							<label htmlFor="role">Role</label>
							<input
								id="role"
								value={authForm.role}
								onChange={handleAuthChange("role")}
								type="text"
							/>
						</div>
					) : null}

					<button type="submit" disabled={registering || loggingIn}>
						{authMode === "login" ? "Login" : "Register"}
					</button>
				</form>

				<button
					type="button"
					onClick={() => setAuthMode((current) => (current === "login" ? "register" : "login"))}
				>
					Switch to {authMode === "login" ? "Register" : "Login"}
				</button>

				<button type="button" onClick={handleLogout}>
					Logout
				</button>

				<p>Token: {token || "No token"}</p>
				<p>
					Current User: {currentUser ? `${currentUser.username} (${currentUser.email})` : "None"}
				</p>
			</section>

			<section>
				<h2>{editingStudentId ? "Edit Student" : "Add Student"}</h2>
				<form onSubmit={handleStudentSubmit}>
					<div>
						<label htmlFor="studentName">Name</label>
						<input
							id="studentName"
							value={studentForm.name}
							onChange={handleStudentChange("name")}
							type="text"
						/>
					</div>

					<div>
						<label htmlFor="studentEmail">Email</label>
						<input
							id="studentEmail"
							value={studentForm.email}
							onChange={handleStudentChange("email")}
							type="email"
						/>
					</div>

					<div>
						<label htmlFor="department">Department</label>
						<input
							id="department"
							value={studentForm.department}
							onChange={handleStudentChange("department")}
							type="text"
						/>
					</div>

					<div>
						<label htmlFor="profileImage">Profile Image</label>
						<input
							id="profileImage"
							onChange={handleStudentImageChange}
							type="file"
							accept="image/*"
						/>
					</div>

					{studentForm.profileImage ? (
						<div>
							<p>Selected image preview:</p>
							<Image src={studentForm.profileImage} alt="Selected preview" width={120} height={120} unoptimized />
						</div>
					) : null}

					<button type="submit" disabled={addingStudent || updatingStudent}>
						{editingStudentId ? "Update Student" : "Add Student"}
					</button>

					{editingStudentId ? (
						<button type="button" onClick={resetStudentForm}>
							Cancel Edit
						</button>
					) : null}
				</form>
			</section>

			<section>
				<h2>Student Profile</h2>
				{selectedStudent ? (
					<div>
						{selectedStudent.profileImage ? (
							<Image src={selectedStudent.profileImage} alt={selectedStudent.name} width={160} height={160} unoptimized />
						) : null}
						<p>ID: {selectedStudent.id}</p>
						<p>Name: {selectedStudent.name}</p>
						<p>Email: {selectedStudent.email}</p>
						<p>Department: {selectedStudent.department}</p>
						<p>Image Path: {selectedStudent.profileImage ?? ""}</p>
					</div>
				) : (
					<p>No student selected.</p>
				)}
			</section>

			<section>
				<h2>All Students</h2>

				{loading ? <p>Loading students...</p> : null}
				{error ? <p>{error.message}</p> : null}
				{message ? <p>{message}</p> : null}

				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>Name</th>
							<th>Email</th>
							<th>Department</th>
							<th>Profile Image</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{data?.students?.length ? (
							data.students.map((student) => (
								<tr key={student.id}>
									<td>{student.id}</td>
									<td>{student.name}</td>
									<td>{student.email}</td>
									<td>{student.department}</td>
									<td>
										{student.profileImage ? (
											<Image src={student.profileImage} alt={student.name} width={80} height={80} unoptimized />
										) : (
											""
										)}
									</td>
									<td>
										<button type="button" onClick={() => handleViewStudent(student)}>
											View Profile
										</button>
										<button type="button" onClick={() => handleEditStudent(student)}>
											Edit
										</button>
										<button type="button" onClick={() => handleDeleteStudent(student.id)} disabled={deletingStudent}>
											Delete
										</button>
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={6}>No students found.</td>
							</tr>
						)}
					</tbody>
				</table>
			</section>
		</main>
	);
}

export default function Home() {
	return (
		<ApolloProvider client={apolloClient}>
			<StudentProfileContent />
		</ApolloProvider>
	);
}

import gql from "graphql-tag";

export const typeDefs = gql`
type User{
  id:ID!
  username:String!
  email:String!
  role:String!
}

type Student{
  id:ID!
  name:String!
  email:String!
  department:String!
  profileImage:String
  createdAt:String!
  updatedAt:String!
}

type Query{
  me: User
  students:[Student!]!
  student(id:ID!):Student
}

type Mutation{
  register(
    username:String!
    email:String!
    password:String!
    role:String
  ):String!

  login(
    email:String!
    password:String!
  ):String!

 addStudent(
    name:String!
    email:String!
    department:String!
    profileImage:String
  ):Student!

  updateStudent(
    id:ID!
    name:String
    email:String
    department:String
    profileImage:String
  ):Student!

  deleteStudent(id:ID!):String!
}
`;
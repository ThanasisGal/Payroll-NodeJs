import { set, connect } from "mongoose";
set("strictQuery", false);
  
const connectDB = async () => {
  try {
    const conn = await connect(process.env.MONGODB_URL);
    console.log(`Database connected: ${conn.connection.host}`);
  } catch (error) {
    console.log('Database not connected ',error);
  }
};

export default connectDB;
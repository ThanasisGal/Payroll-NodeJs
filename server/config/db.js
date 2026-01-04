const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Database connected");
    // console.log(`Database connected: ${conn.connection.host}`);
  } catch (error) {
    console.log("❌ Database not connected");
    // console.log("Database not connected", error);
  }
};

module.exports = connectDB;

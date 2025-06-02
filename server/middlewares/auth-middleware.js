const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");

var checkUserAuth = async (req, res, next) => {
  let token;

  // Get Token from header
  const {authorization} = req.headers;

  try {
    if (authorization && authorization.startsWith("Bearer")) {
      token = authorization.split(" ")[1];
      // Verify token
      const { userID } = jwt.verify(token, process.env.JWT_SECRET_KEY);
      
      // Get User from Token
      req.user = await UserModel.findById(userID).select('-password');

      next();
    }
  } catch (error) {
    res.status(401).send({
      status: "failed",
      message: "Μη εξουσιοδοτημένος χρήστης",
    });
  }
  if (!token) {
    res.status(401).send({
      status: "failed",
      message: "Unauthorized user",
    });
  }
};

module.exports = checkUserAuth;

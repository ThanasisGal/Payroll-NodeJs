const checkAuth = async (req, res, next) => {
    // var types, messages, images;
    if (!req.session || !req.session.userId) {
      return await res.redirect("/login");
      ;
    };
  next();
};

module.exports = checkAuth;

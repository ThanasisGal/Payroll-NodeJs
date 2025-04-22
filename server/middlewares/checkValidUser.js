const checkAuth = async (req, res, next) => {
    // var types, messages, images;
    if (!req.session || !req.session.userId) {
      // await req.flash( "message","Πρέπει να συνδεθείτε πρώτα !!!" );
      // messages = req.flash("message");
      // await req.flash("type", process.env._ERROR);
      // types = req.flash("type");
      // await req.flash("img", process.env._IMG_ERROR);
      // images = req.flash("img");
      return await res.redirect("/login");
      ;
    };
  next();
};

export default checkAuth;

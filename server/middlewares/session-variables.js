var getSessionVars = async (req, res, next) =>{
  try {
    if (req.session) {
    // if (req.session && req.session.userId) {
      res.locals.userId = req.session.userId;
      res.locals.userName = req.session.userName;
      res.locals.userTeam = req.session.userTeam;
      res.locals.userRole = req.session.userRole;
      res.locals.userStatus = req.session.userStatus;
      res.locals.companyInUse = req.session.companyInUse;
      res.locals.companyDescription = req.session.companyDescription;
      res.locals.yearInUse = req.session.yearInUse;
      res.locals.periodInUse = req.session.periodInUse;
      res.locals.periodInUseDescr = req.session.periodInUseDescr;
      res.locals.appDate = req.session.appDate;
    } else {
      res.locals.userId = null;
    }
    next();
  } catch (err) {
    console.error("Error in getSessionVars:", err);
    next(err); // ή res.status(500).send("Something went wrong")
  }
};

export default getSessionVars
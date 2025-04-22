var getSessionVars = async (req, res, next) =>{
  if (req.session && req.session.userId) {
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
};

export default getSessionVars
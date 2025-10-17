import { appInstallationQueue } from "../queue/appInstallationQueue.js";

export const appInstallMiddleware = async (req, res, next) => {
  try {
    const session = res.locals.shopify.session;
    await appInstallationQueue.add("add_appinstallqueue", { session });
    next();
  } catch (err) {
    console.log(err.message);
    res.send(err.message);
  }
};

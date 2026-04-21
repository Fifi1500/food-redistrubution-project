import { Router } from "express";
import {
  auth,
  role,
  isAdmin,
  createDonationValidation,
  updateDonationStatusValidation,
  nearbyDonationsValidation,
  idParamValidation,
  paginationValidation,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  changeRoleValidation,
} from "../middleware";
import {
  AuthController,
  DonationController,
  RequestController,
  UserController,
  NotificationController,
  StatsController,
} from "../controllers";
import { getAllWilayas, WILAYAS } from "../utils/myFanc";

const router = Router();

// ============ PUBLIC ============
router.post("/auth/register", registerValidation, AuthController.register);
router.post("/auth/login", loginValidation, AuthController.login);
router.get("/donations/units", DonationController.getUnits);
router.get("/wilayas", (req, res) => {
  try {
    const wilayas = getAllWilayas();
    res.json({
      success: true,
      count: wilayas.length,
      wilayas,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
// ============ PROTECTED ============
router.use(auth);

// Profil
router.get("/auth/profile", AuthController.Profile);
router.put(
  "/auth/profile",
  updateProfileValidation,
  UserController.updateProfile,
);
router.post(
  "/auth/change-password",
  changePasswordValidation,
  UserController.changePassword,
);
router.delete("/auth/account", UserController.deleteAccount);

// ============ Users (Admin) ============
router.get(
  "/users",
  role(["admin"]),
  paginationValidation,
  UserController.getAllUsers,
);
router.get(
  "/users/unverified",
  role(["admin"]),
  UserController.getUnverifiedUsers,
);
router.get(
  "/users/:id",
  role(["admin"]),
  idParamValidation,
  UserController.getUserById,
);

//  to activer a user
router.patch(
  "/users/:id/activate",
  role(["admin"]),
  idParamValidation,
  UserController.activateUser,
);
router.patch(
  "/users/:id/deactivate",
  role(["admin"]),
  idParamValidation,
  UserController.deactivateUser,
);
// changer le role de user
router.patch(
  "/users/:id/role",
  role(["admin"]),
  changeRoleValidation,
  UserController.changeRole,
);
router.delete(
  "/users/:id",
  role(["admin"]),
  idParamValidation,
  UserController.deleteUser,
);
router.patch(
  "/users/donor/:id/verify",
  role(["admin"]),
  idParamValidation,
  UserController.verifyDonor,
);
router.patch(
  "/users/beneficiary/:id/verify",
  role(["admin"]),
  idParamValidation,
  UserController.verifyBeneficiary,
);
// ============ DONATIONS ============
router.post(
  "/donations",
  role(["donor"]),
  createDonationValidation,
  DonationController.create,
);
router.get("/donations", paginationValidation, DonationController.list);
router.get(
  "/donations/nearby",
  nearbyDonationsValidation,
  DonationController.nearby,
);
router.get("/donations/my", role(["donor"]), DonationController.myDonations);
// beneficiaries see details of a donation
router.get("/donations/:id", idParamValidation, DonationController.getOne);

// donor update status
router.patch(
  "/donations/:id/status",
  role(["donor"]),
  updateDonationStatusValidation,
  DonationController.updateStatus,
);

router.delete(
  "/donations/:id",
  role(["donor", "admin"]),
  idParamValidation,
  DonationController.delete,
);

// ============ REQUESTS ============
router.post("/requests", role(["beneficiary"]), RequestController.create);
router.get("/requests/my", role(["beneficiary"]), RequestController.myRequests);
router.get(
  "/requests/received",
  role(["donor"]),
  RequestController.receivedRequests,
);

router.patch(
  "/requests/:id/status",
  role(["donor"]),
  idParamValidation,
  RequestController.updateStatus,
);

// Notifications
router.get("/notifications", auth, NotificationController.getMyNotifications);
router.patch(
  "/notifications/:id/read",
  auth,
  NotificationController.markAsRead,
);
router.patch(
  "/notifications/read-all",
  auth,
  NotificationController.markAllAsRead,
);

// ============================================
// stats and  IMPACT
// ============================================

router.get(
  "/stats/dashboard",
  role(["admin"]),
  StatsController.getDashboardStats,
);
router.get("/stats/quick", role(["admin"]), StatsController.getQuickStats);
router.get(
  "/stats/activities",
  role(["admin"]),
  StatsController.getRecentActivities,
);
router.get("/stats/impact", role(["admin"]), StatsController.getOverallImpact);
router.get(
  "/stats/impact/period",
  role(["admin"]),
  StatsController.getImpactByPeriod,
);
router.get(
  "/stats/impact/wilaya",
  role(["admin"]),
  StatsController.getImpactByWilaya,
);
router.get("/stats/top-donors", role(["admin"]), StatsController.getTopDonors);
router.get(
  "/stats/top-beneficiaries",
  role(["admin"]),
  StatsController.getTopBeneficiaries,
);

export default router;

// Filtrer les dons par wilaya
router.get(
  "/donations/wilaya/:wilaya",
  paginationValidation,
  DonationController.getByWilaya,
);

// Liste des wilayas
router.get("/wilayas", (req, res) => {
  res.json({ wilayas: Object.values(WILAYAS) });
});

import { DistributionController } from "../controllers";

// ============================================
// DISTRIBUTIONS (Suivi des redistributions)
// ============================================

router.get("/distributions", role(["admin"]), DistributionController.getAll);
router.get(
  "/distributions/:id",
  role(["admin"]),
  DistributionController.getOne,
);
router.get(
  "/distributions/stats",
  role(["admin"]),
  DistributionController.getStats,
);
router.patch(
  "/distributions/:id/status",
  role(["donor", "admin"]),
  DistributionController.updateStatus,
);
router.post(
  "/distributions/:id/cancel",
  role(["donor", "admin"]),
  DistributionController.cancel,
);

import { PDFController } from "../controllers";

// ============================================
// EXPORT PDF
// ============================================

router.get("/pdf/donations", role(["admin"]), PDFController.exportDonationsPDF);
router.get("/pdf/users", role(["admin"]), PDFController.exportUsersPDF);
router.get("/pdf/stats", role(["admin"]), PDFController.exportStatsPDF);

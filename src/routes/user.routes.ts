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
} from "../controllers";

const router = Router();

// ============ PUBLIC ============
router.post("/auth/register", registerValidation, AuthController.register);
router.post("/auth/login", loginValidation, AuthController.login);
router.get("/donations/units", DonationController.getUnits);
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
export default router;

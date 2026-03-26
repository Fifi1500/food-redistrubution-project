import { Router } from "express";
import {
  auth,
  role,
  isDonor,
  isBeneficiary,
  registerValidation,
  loginValidation,
  createDonationValidation,
  idParamValidation,
  paginationValidation,
} from "../middleware";
import {
  AuthController,
  DonationController,
  RequestController,
} from "../controllers";

const router = Router();

// ============ PUBLIC ============
router.post("/auth/register", registerValidation, AuthController.register);
router.post("/auth/login", loginValidation, AuthController.login);

// ============ PROTECTED ============
router.use(auth);

// Profil
router.get("/auth/profile", AuthController.Profile);

// ============ DONATIONS ============
router.post(
  "/donations",
  role(["donor"]),
  createDonationValidation,
  DonationController.create,
);
router.get("/donations", paginationValidation, DonationController.list);
router.get("/donations/nearby", DonationController.nearby);
router.get("/donations/my", role(["donor"]), DonationController.myDonations);
router.get("/donations/:id", idParamValidation, DonationController.getOne);
router.patch(
  "/donations/:id/status",
  role(["donor"]),
  DonationController.updateStatus,
);
router.delete(
  "/donations/:id",
  role(["donor", "admin"]),
  idParamValidation,
  DonationController.delete,
);
router.get("/donations/units", DonationController.getUnits);

// ============ REQUESTS ============
router.post("/requests", role(["beneficiary"]), RequestController.create);
router.get("/requests/my", role(["beneficiary"]), RequestController.myRequests);
router.get(
  "/requests/received",
  role(["donor"]),
  RequestController.receivedRequests,
);
router.patch(
  "/requests/:id/approve",
  role(["donor"]),
  RequestController.approve,
);
router.patch("/requests/:id/reject", role(["donor"]), RequestController.reject);
router.patch(
  "/requests/:id/complete",
  role(["beneficiary"]),
  RequestController.complete,
);

export default router;

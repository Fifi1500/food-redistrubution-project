import { Router } from "express";
import { DonationController } from "../controllers/donation.controller";
import { authMiddleware, roleMiddleware } from "../middleware/auth.middleware";

const router = Router();
const donationController = new DonationController();

// Routes publiques (accessibles sans authentification)
router.get(
  "/available",
  donationController.getAvailable.bind(donationController),
);
router.get("/nearby", donationController.getNearby.bind(donationController));
router.get("/:id", donationController.getOne.bind(donationController));

// Routes protégées (nécessitent authentification)
router.use(authMiddleware);

// Routes pour donateurs uniquement
router.post(
  "/",
  roleMiddleware(["donor"]),
  donationController.create.bind(donationController),
);

router.get(
  "/donor/my-donations",
  roleMiddleware(["donor"]),
  donationController.getMyDonations.bind(donationController),
);

router.patch(
  "/:id/status",
  roleMiddleware(["donor"]),
  donationController.updateStatus.bind(donationController),
);

router.delete(
  "/:id",
  roleMiddleware(["donor", "admin"]),
  donationController.delete.bind(donationController),
);

export default router;

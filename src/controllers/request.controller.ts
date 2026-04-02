import { Request, Response } from "express";
import { RequestService } from "../services";

const requestService = new RequestService();

export class RequestController {
  static async create(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const { donationId, quantity, notes } = req.body;
      const request = await requestService.createRequest(
        user,
        donationId,
        quantity,
        notes,
      );
      res.status(201).json(request);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const request = await requestService.updateRequestStatus(
        id,
        status,
        user,
      );

      res.json({
        message: `Statut de la demande changé à ${status}`,
        request,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async myRequests(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const requests = await requestService.getMyRequests(user);
      res.json({ requests });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async receivedRequests(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const requests = await requestService.getReceivedRequests(user);
      res.json({ requests });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

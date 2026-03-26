import { Request, Response } from "express";
import { RequestService } from "../services";

const requestService = new RequestService();

export class RequestController {
  // ✅ Ajouter "static"
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

  static async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const request = await requestService.approveRequest(id);
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async reject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const request = await requestService.rejectRequest(id, notes);
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async complete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const request = await requestService.completeRequest(id);
      res.json(request);
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

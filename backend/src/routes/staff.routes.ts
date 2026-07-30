import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { StaffService } from "@/services/staff.service";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

const router = Router();

router.use(verifyToken);
router.use(requireMerchantAccess);
router.use(setMerchantContext);

function requireStaffManage(req: Request, res: Response, next: () => void) {
  if (req.user?.role === "merchant") return next();
  const perms = req.user?.permissions || [];
  if (perms.includes("MANAGE_STAFF") || perms.includes("MANAGE_ROLES")) return next();
  return res.status(403).json({ error: "Staff management permission required" });
}

router.get("/permissions", (_req: Request, res: Response) => {
  res.json({ success: true, permissions: ALL_PERMISSIONS });
});

router.get("/roles", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const roles = await StaffService.listRoles(merchantId);
    res.json({
      success: true,
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions.split(",").filter(Boolean),
        isSystem: r.isSystem,
        sortOrder: r.sortOrder,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list roles" });
  }
});

router.post("/roles", requireStaffManage, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { name, permissions } = req.body;
    const role = await StaffService.createRole(merchantId, name, (permissions || []) as Permission[]);
    res.json({ success: true, role });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create role" });
  }
});

router.put("/roles/:roleId", requireStaffManage, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { name, permissions } = req.body;
    const role = await StaffService.updateRole(merchantId, req.params.roleId, {
      name,
      permissions: permissions as Permission[] | undefined,
    });
    res.json({ success: true, role });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update role" });
  }
});

router.delete("/roles/:roleId", requireStaffManage, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    await StaffService.deleteRole(merchantId, req.params.roleId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete role" });
  }
});

router.get("/staff", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const staff = await StaffService.listStaff(merchantId);
    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list staff" });
  }
});

router.post("/staff", requireStaffManage, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const staff = await StaffService.createStaff(merchantId, req.body);
    res.json({ success: true, staff });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create staff" });
  }
});

router.put("/staff/:staffId", requireStaffManage, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const staff = await StaffService.updateStaff(merchantId, req.params.staffId, req.body);
    res.json({ success: true, staff });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update staff" });
  }
});

router.delete("/staff/:staffId", requireStaffManage, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    await StaffService.deleteStaff(merchantId, req.params.staffId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete staff" });
  }
});

/** WebPOS / counter PIN verify (merchant JWT required) */
router.post("/staff/verify-pin", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { pin } = req.body;
    const staff = await StaffService.verifyPin(merchantId, String(pin || ""));
    res.json({ success: true, staff });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Invalid PIN" });
  }
});

export default router;

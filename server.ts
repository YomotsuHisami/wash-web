import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const ORDER_UPLOADS_DIR = path.join(UPLOADS_DIR, "orders");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SHOPS_FILE = path.join(DATA_DIR, "shops.json");
const ADMIN_CONFIG_FILE = path.join(DATA_DIR, "admin_config.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const DISCOUNTS_FILE = path.join(DATA_DIR, "discounts.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ORDER_UPLOADS_DIR)) {
  fs.mkdirSync(ORDER_UPLOADS_DIR, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(SHOPS_FILE)) {
  fs.writeFileSync(
    SHOPS_FILE,
    JSON.stringify([
      {
        id: "1",
        name: "1鞋店",
        address: "北苑路1号",
        distanceKm: 2.6,
        qualityScore: 86,
        valueScore: 84,
        speedScore: 91,
        oxidationScore: 72,
        specialtyMaterials: ["网布拼接", "合成革", "橡胶大底"],
        specialtyServices: ["当日快洗", "基础精洗", "鞋底护理"],
      },
      {
        id: "2",
        name: "2鞋店",
        address: "南苑路2号",
        distanceKm: 1.8,
        qualityScore: 90,
        valueScore: 76,
        speedScore: 78,
        oxidationScore: 92,
        specialtyMaterials: ["头层牛皮", "麂皮", "漆皮涂层"],
        specialtyServices: ["深度精洗", "去氧化", "皮面养护"],
      },
      {
        id: "3",
        name: "3鞋店",
        address: "东苑路3号",
        distanceKm: 3.4,
        qualityScore: 82,
        valueScore: 93,
        speedScore: 86,
        oxidationScore: 74,
        specialtyMaterials: ["Primeknit 编织", "网布拼接", "Boost 发泡"],
        specialtyServices: ["轻奢快洗", "中底提亮", "高性价比套餐"],
      },
    ])
  );
}
if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
  fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify({ password: "" }));
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(DISCOUNTS_FILE)) {
  fs.writeFileSync(DISCOUNTS_FILE, JSON.stringify([]));
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[JSON READ ERROR] ${filePath}:`, error);
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown) {
  const tempFilePath = `${filePath}.tmp`;
  fs.writeFileSync(tempFilePath, JSON.stringify(data, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function ensureUploadsDir() {
  if (!fs.existsSync(ORDER_UPLOADS_DIR)) {
    fs.mkdirSync(ORDER_UPLOADS_DIR, { recursive: true });
  }
}

function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "order";
}

function extractDataUrlParts(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const base64 = match[2];
  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return {
    mimeType,
    base64,
    extension: extensionMap[mimeType] || "jpg",
  };
}

function persistImageDataUrl(dataUrl: string, orderId: string, index: number) {
  ensureUploadsDir();
  const parts = extractDataUrlParts(dataUrl);
  if (!parts) {
    return dataUrl;
  }

  const fileName = `${sanitizeFileSegment(orderId)}-${index + 1}.${parts.extension}`;
  const filePath = path.join(ORDER_UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(parts.base64, "base64"));
  return `/uploads/orders/${fileName}`;
}

function persistOrderImages<T extends Record<string, any>>(order: T): T {
  const sourceImages = Array.isArray(order.imageUrls) && order.imageUrls.length > 0
    ? order.imageUrls.filter((image: unknown): image is string => typeof image === "string" && !!image)
    : typeof order.imageUrl === "string" && order.imageUrl
      ? [order.imageUrl]
      : [];

  if (sourceImages.length === 0) {
    return order;
  }

  const persistedImages = sourceImages.map((image, index) =>
    isDataUrl(image) ? persistImageDataUrl(image, order.id || Date.now().toString(), index) : image
  );

  return {
    ...order,
    imageUrl: persistedImages[0],
    imageUrls: persistedImages,
  };
}

function removeOrderImages(order: Record<string, any>) {
  const images = [
    ...(Array.isArray(order.imageUrls) ? order.imageUrls : []),
    order.imageUrl,
  ].filter((value, index, list): value is string => typeof value === "string" && list.indexOf(value) === index);

  for (const imagePath of images) {
    if (!imagePath.startsWith("/uploads/orders/")) continue;
    const absolutePath = path.join(UPLOADS_DIR, imagePath.replace(/^\/uploads\//, ""));
    if (!absolutePath.startsWith(UPLOADS_DIR)) continue;
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }
}

function migrateEmbeddedOrderImages() {
  const orders = readJsonFile<Record<string, any>[]>(ORDERS_FILE, []);
  let changed = false;

  const nextOrders = orders.map((order) => {
    const hasEmbeddedImage =
      isDataUrl(order.imageUrl) ||
      (Array.isArray(order.imageUrls) && order.imageUrls.some(isDataUrl));

    if (!hasEmbeddedImage) {
      return order;
    }

    changed = true;
    return persistOrderImages(order);
  });

  if (changed) {
    writeJsonFile(ORDERS_FILE, nextOrders);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 允许三张 base64 图片的请求体（开发阶段）
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ limit: '35mb', extended: true }));
  app.use("/uploads", express.static(UPLOADS_DIR));
  migrateEmbeddedOrderImages();

  // --- API Routes ---

  // Admin Auth
  app.post("/api/admin/setup", (req, res) => {
    const { password } = req.body;
    const config = readJsonFile(ADMIN_CONFIG_FILE, { password: "" });
    if (config.password) {
      return res.status(400).json({ error: "Password already set" });
    }
    config.password = password; // In a real app, hash this!
    writeJsonFile(ADMIN_CONFIG_FILE, config);
    res.json({ success: true });
  });

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const config = readJsonFile(ADMIN_CONFIG_FILE, { password: "" });
    
    if (!config.password) {
      return res.status(400).json({ error: "Password not set up yet", needsSetup: true });
    }

    if (password === config.password) {
      res.json({ success: true, token: "demo-token" }); // Simple token for demo
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  app.get("/api/admin/status", (req, res) => {
    const config = readJsonFile(ADMIN_CONFIG_FILE, { password: "" });
    res.json({ isSetup: !!config.password });
  });

  // Simple admin token verify for frontend
  app.get("/api/admin/verify", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token === "demo-token") {
      return res.json({ success: true });
    }
    return res.status(401).json({ error: "Unauthorized" });
  });

  // Middleware to check demo token
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token === "demo-token") {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  // Orders API
  app.get("/api/orders", requireAdmin, (req, res) => {
    const orders = readJsonFile<any[]>(ORDERS_FILE, []);
    res.json(orders);
  });

  app.post("/api/orders", (req, res) => {
    const newOrder = persistOrderImages(req.body);
    const orders = readJsonFile<any[]>(ORDERS_FILE, []);
    orders.push(newOrder);
    writeJsonFile(ORDERS_FILE, orders);
    res.json({ success: true, order: newOrder });
  });

  app.put("/api/orders/:id/status", requireAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const orders = readJsonFile<any[]>(ORDERS_FILE, []);
    const orderIndex = orders.findIndex((o: any) => o.id === id);
    
    if (orderIndex !== -1) {
      orders[orderIndex].status = status;
      writeJsonFile(ORDERS_FILE, orders);
      res.json({ success: true, order: orders[orderIndex] });
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  app.post("/api/orders/:id/pay", (req, res) => {
    const { id } = req.params;
    const orders = readJsonFile<any[]>(ORDERS_FILE, []);
    const orderIndex = orders.findIndex((o: any) => o.id === id);
    
    if (orderIndex !== -1) {
      orders[orderIndex].status = 'paid';
      writeJsonFile(ORDERS_FILE, orders);
      res.json({ success: true, order: orders[orderIndex] });
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  app.delete("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const orders = readJsonFile<any[]>(ORDERS_FILE, []);
    const orderToRemove = orders.find((o: any) => o.id === id);
    if (orderToRemove) {
      removeOrderImages(orderToRemove);
    }
    const nextOrders = orders.filter((o: any) => o.id !== id);
    writeJsonFile(ORDERS_FILE, nextOrders);
    res.json({ success: true });
  });

  app.get("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const orders = readJsonFile<any[]>(ORDERS_FILE, []);
    const order = orders.find((o: any) => o.id === id);
    
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  // Shops API
  app.get("/api/shops", (req, res) => {
    const shops = readJsonFile<any[]>(SHOPS_FILE, []);
    res.json(shops);
  });

  app.post("/api/shops", requireAdmin, (req, res) => {
    const newShop = { id: Date.now().toString(), ...req.body };
    const shops = readJsonFile<any[]>(SHOPS_FILE, []);
    shops.push(newShop);
    writeJsonFile(SHOPS_FILE, shops);
    res.json({ success: true, shop: newShop });
  });

  app.put("/api/shops/:id", requireAdmin, (req, res) => {
    const { id } = req.params;
    const updatedShop = req.body;
    const shops = readJsonFile<any[]>(SHOPS_FILE, []);
    const shopIndex = shops.findIndex((s: any) => s.id === id);
    
    if (shopIndex !== -1) {
      shops[shopIndex] = { ...shops[shopIndex], ...updatedShop };
      writeJsonFile(SHOPS_FILE, shops);
      res.json({ success: true, shop: shops[shopIndex] });
    } else {
      res.status(404).json({ error: "Shop not found" });
    }
  });

  app.delete("/api/shops/:id", requireAdmin, (req, res) => {
    const { id } = req.params;
    let shops = readJsonFile<any[]>(SHOPS_FILE, []);
    shops = shops.filter((s: any) => s.id !== id);
    writeJsonFile(SHOPS_FILE, shops);
    res.json({ success: true });
  });

  // --- User Accounts & Membership ---

  const normalizeUserPayload = (user: any) => {
    const legacyDefault =
      user.defaultInfo && Object.values(user.defaultInfo).some(Boolean)
        ? {
            id: user.defaultInfoId || "legacy-default-order-info",
            label: "默认订单资料",
            ...user.defaultInfo,
          }
        : null;

    const orderInfos = Array.isArray(user.orderInfos)
      ? user.orderInfos
      : legacyDefault
      ? [legacyDefault]
      : [];

    const defaultInfoId =
      user.defaultInfoId && orderInfos.some((item: any) => item.id === user.defaultInfoId)
        ? user.defaultInfoId
        : orderInfos[0]?.id;

    const defaultInfo =
      orderInfos.find((item: any) => item.id === defaultInfoId) || orderInfos[0] || {};

    return {
      ...user,
      orderInfos,
      defaultInfoId,
      defaultInfo,
    };
  };

  app.post("/api/users/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }

    const users = readJsonFile<any[]>(USERS_FILE, []);
    if (users.find((u: any) => u.username === username)) {
      return res.status(400).json({ error: "该用户名已被注册" });
    }

    const newUser = {
      id: Date.now().toString(),
      username,
      password,
      group: "normal",
      defaultInfoId: "",
      orderInfos: [],
      defaultInfo: {},
    };

    users.push(newUser);
    writeJsonFile(USERS_FILE, users);

    res.json(normalizeUserPayload(newUser));
  });

  app.post("/api/users/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }

    const users = readJsonFile<any[]>(USERS_FILE, []);
    const user = users.find(
      (u: any) => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    res.json(normalizeUserPayload(user));
  });

  app.get("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const users = readJsonFile<any[]>(USERS_FILE, []);
    const user = users.find((u: any) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }

    res.json(normalizeUserPayload(user));
  });

  app.put("/api/users/:id/defaultInfo", (req, res) => {
    const { id } = req.params;
    const defaultInfo = req.body;

    const users = readJsonFile<any[]>(USERS_FILE, []);
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "用户不存在" });
    }

    const normalizedUser = normalizeUserPayload(users[index]);
    const defaultInfoId = normalizedUser.defaultInfoId || `order-info-${Date.now()}`;
    const existingIndex = normalizedUser.orderInfos.findIndex(
      (item: any) => item.id === defaultInfoId
    );
    const nextOrderInfo = {
      ...(normalizedUser.orderInfos[existingIndex] || {
        id: defaultInfoId,
        label: "默认订单资料",
      }),
      ...defaultInfo,
      id: defaultInfoId,
      label:
        defaultInfo.label ||
        normalizedUser.orderInfos[existingIndex]?.label ||
        "默认订单资料",
    };

    if (existingIndex >= 0) {
      normalizedUser.orderInfos[existingIndex] = nextOrderInfo;
    } else {
      normalizedUser.orderInfos = [...normalizedUser.orderInfos, nextOrderInfo];
    }

    users[index] = {
      ...users[index],
      orderInfos: normalizedUser.orderInfos,
      defaultInfoId,
      defaultInfo: nextOrderInfo,
    };

    writeJsonFile(USERS_FILE, users);

    res.json(normalizeUserPayload(users[index]));
  });

  app.put("/api/users/:id/orderInfos", (req, res) => {
    const { id } = req.params;
    const { orderInfos, defaultInfoId } = req.body;

    const users = readJsonFile<any[]>(USERS_FILE, []);
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "用户不存在" });
    }

    const nextOrderInfos = Array.isArray(orderInfos) ? orderInfos : [];
    const nextDefaultInfoId =
      defaultInfoId && nextOrderInfos.some((item: any) => item.id === defaultInfoId)
        ? defaultInfoId
        : nextOrderInfos[0]?.id || "";

    users[index] = {
      ...users[index],
      orderInfos: nextOrderInfos,
      defaultInfoId: nextDefaultInfoId,
      defaultInfo:
        nextOrderInfos.find((item: any) => item.id === nextDefaultInfoId) || {},
    };

    writeJsonFile(USERS_FILE, users);
    res.json(normalizeUserPayload(users[index]));
  });

  app.put("/api/users/:id/password", (req, res) => {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "新密码不能为空" });
    }

    const users = readJsonFile<any[]>(USERS_FILE, []);
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "用户不存在" });
    }

    if (users[index].password && oldPassword && users[index].password !== oldPassword) {
      return res.status(401).json({ error: "原密码不正确" });
    }

    users[index].password = newPassword;
    writeJsonFile(USERS_FILE, users);

    res.json({ success: true });
  });

  app.post("/api/users/:id/upgrade", (req, res) => {
    const { id } = req.params;

    const users = readJsonFile<any[]>(USERS_FILE, []);
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "用户不存在" });
    }

    users[index].group = "vip";
    writeJsonFile(USERS_FILE, users);

    res.json(normalizeUserPayload(users[index]));
  });

  // --- Discount Management ---

  app.get("/api/discounts", (req, res) => {
    const discounts = readJsonFile<any[]>(DISCOUNTS_FILE, []);
    res.json(discounts);
  });

  app.post("/api/discounts", requireAdmin, (req, res) => {
    const {
      title,
      description,
      rate,
      startTime,
      endTime,
      imageUrl,
      applicableGroup,
      mode,
    } = req.body;

    if (!title || !rate) {
      return res.status(400).json({ error: "折扣标题和幅度不能为空" });
    }

    const discounts = readJsonFile<any[]>(DISCOUNTS_FILE, []);

    const newDiscount = {
      id: Date.now().toString(),
      title,
      description: description || "",
      rate: Number(rate),
      startTime: startTime || "",
      endTime: endTime || "",
      imageUrl: imageUrl || "",
      applicableGroup: applicableGroup || "normal",
      mode: mode === "first_order" ? "first_order" : "normal",
    };

    discounts.push(newDiscount);
    writeJsonFile(DISCOUNTS_FILE, discounts);

    res.json({ success: true, discount: newDiscount });
  });

  app.put("/api/discounts/:id", requireAdmin, (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const discounts = readJsonFile<any[]>(DISCOUNTS_FILE, []);
    const index = discounts.findIndex((d: any) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "折扣不存在" });
    }

    discounts[index] = {
      ...discounts[index],
      ...updates,
      rate: updates.rate !== undefined ? Number(updates.rate) : discounts[index].rate,
      mode: updates.mode === "first_order"
        ? "first_order"
        : (discounts[index].mode || "normal"),
    };

    writeJsonFile(DISCOUNTS_FILE, discounts);

    res.json({ success: true, discount: discounts[index] });
  });

  app.delete("/api/discounts/:id", requireAdmin, (req, res) => {
    const { id } = req.params;
    let discounts = readJsonFile<any[]>(DISCOUNTS_FILE, []);
    discounts = discounts.filter((d: any) => d.id !== id);
    writeJsonFile(DISCOUNTS_FILE, discounts);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

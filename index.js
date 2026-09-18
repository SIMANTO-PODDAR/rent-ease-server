const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dotenv = require("dotenv");
dotenv.config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((url) => url.trim().replace(/\/$/, ""))
  : [];

app.use(
  cors({
    credentials: true,
    origin: allowedOrigins,
  }),
);

app.use(express.json());

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${allowedOrigins[0]}/api/auth/jwks`),
);

const verifyUserToken = async (req, res, next) => {
  // Verify User
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const userToken = authHeader.split(" ")[1];

  if (!userToken) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const { payload } = await jwtVerify(userToken, JWKS);
    req.user = payload;

    next();
  } catch (error) {
    return res.status(403).json({
      message: "Token verification failed. Please log in again.",
    });
  }
};

const extractIdentity = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const userToken = authHeader.split(" ")[1];
  if (!userToken) {
    req.user = null;
    return next();
  }

  try {
    const { payload } = await jwtVerify(userToken, JWKS);
    req.user = payload;
  } catch (error) {
    req.user = null;
  }
  next();
};

function parseUserAgent(ua) {
  let browser = "Unknown";
  let browserVersion = "Unknown";
  let os = "Unknown";
  let osVersion = "Unknown";
  let deviceType = "Desktop";

  if (!ua) return { browser, browserVersion, os, osVersion, deviceType };

  if (ua.indexOf("Firefox") > -1) {
    browser = "Firefox";
    let match = ua.match(/Firefox\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.indexOf("Edg") > -1) {
    browser = "Edge";
    let match = ua.match(/Edg\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.indexOf("Chrome") > -1) {
    browser = "Chrome";
    let match = ua.match(/Chrome\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.indexOf("Safari") > -1) {
    browser = "Safari";
    let match = ua.match(/Version\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  }

  if (ua.indexOf("Windows NT 10.0") > -1) { os = "Windows"; osVersion = "10/11"; }
  else if (ua.indexOf("Windows NT 6.3") > -1) { os = "Windows"; osVersion = "8.1"; }
  else if (ua.indexOf("Windows NT 6.2") > -1) { os = "Windows"; osVersion = "8"; }
  else if (ua.indexOf("Windows NT 6.1") > -1) { os = "Windows"; osVersion = "7"; }
  else if (ua.indexOf("Mac OS X") > -1) {
    os = "Mac OS";
    let match = ua.match(/Mac OS X ([0-9_]+)/);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (ua.indexOf("Android") > -1) {
    os = "Android";
    let match = ua.match(/Android ([0-9.]+)/);
    if (match) osVersion = match[1];
    deviceType = "Mobile";
  } else if (ua.indexOf("iPhone") > -1) {
    os = "iOS";
    let match = ua.match(/OS ([0-9_]+)/);
    if (match) osVersion = match[1].replace(/_/g, ".");
    deviceType = "Mobile";
  } else if (ua.indexOf("iPad") > -1) {
    os = "iOS";
    let match = ua.match(/OS ([0-9_]+)/);
    if (match) osVersion = match[1].replace(/_/g, ".");
    deviceType = "Tablet";
  } else if (ua.indexOf("Linux") > -1) {
    os = "Linux";
  }

  if (ua.indexOf("Mobi") > -1 && deviceType === "Desktop") {
    deviceType = "Mobile";
  }

  return { browser, browserVersion, os, osVersion, deviceType };
}


const verifyRole = (...roles) => {
  // Verify Role ("Tenant", "Owner", "Admin")
  return (req, res, next) => {
    // console.log(req.user)
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    next();
  };
};

async function run() {
  try {
    // await client.connect();                                  //   <--- !

    //---------   DB & COLLECTIONS   ---------\\
    const db = client.db("rent-ease");

    const propertiesCollection = db.collection("all-properties");
    const reviewsCollection = db.collection("all-reviews");
    const favoritesCollection = db.collection("all-favorites");
    const bookingsCollection = db.collection("all-bookings");
    const usersCollection = db.collection("user");
    const trackingSessionsCollection = db.collection("tracking-sessions");
    const trackingActivitiesCollection = db.collection("tracking-activities");

    //---------     API Endpoint     ---------\\

    //---------     User     ---------\\

    // All User
    app.get(
      "/all-user",
      verifyUserToken,
      verifyRole("Admin"),
      async (req, res) => {
        if (req.query.page || req.query.limit) {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const skip = (page - 1) * limit;

          const totalUsers = await usersCollection.countDocuments();
          const totalPages = Math.ceil(totalUsers / limit);

          const result = await usersCollection
            .find()
            .skip(skip)
            .limit(limit)
            .toArray();

          return res.json({
            users: result,
            totalUsers,
            totalPages,
            currentPage: page,
          });
        }

        const result = await usersCollection.find().toArray();
        res.json(result);
      },
    );

    // Update User Role
    app.patch(
      "/all-user/:userId",
      verifyUserToken,
      verifyRole("Admin"),
      async (req, res) => {
        const { userId } = req.params;
        const userRole = req.body;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: userRole },
        );
        res.json(result);
      },
    );

    //---------     Bookings     ---------\\

    // All Bookings Data
    app.get(
      "/all-bookings",
      verifyUserToken,
      verifyRole("Admin"),
      async (req, res) => {
        if (req.query.page || req.query.limit) {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const skip = (page - 1) * limit;

          const totalBookings = await bookingsCollection.countDocuments();
          const totalPages = Math.ceil(totalBookings / limit);

          const result = await bookingsCollection
            .find()
            .skip(skip)
            .limit(limit)
            .toArray();

          return res.json({
            bookings: result,
            totalBookings,
            totalPages,
            currentPage: page,
          });
        }

        const result = await bookingsCollection.find().toArray();
        res.json(result);
      },
    );

    // ADD 1 booking
    app.post(
      "/all-bookings",
      verifyUserToken,
      verifyRole("Tenant"),
      async (req, res) => {
        const booking = req.body;
        const result = await bookingsCollection.insertOne(booking);
        res.json(result);
      },
    );

    // Update Booking
    app.patch(
      "/all-bookings/:bookingId",
      verifyUserToken,
      verifyRole("Owner", "Tenant"),
      async (req, res) => {
        const { bookingId } = req.params;
        const Data = req.body;

        // console.log(Data);
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: Data },
        );
        res.json(result);
      },
    );

    // Get booking data by tenantId
    app.get(
      "/tenant-bookings/:tenantId",
      verifyUserToken,
      verifyRole("Tenant"),
      async (req, res) => {
        const { tenantId } = req.params;

        const result = await bookingsCollection
          .find({
            tenantId: tenantId,
          })
          .toArray();

        res.json(result);
      },
    );

    // Get booking data by ownerId
    app.get(
      "/owner-bookings/:ownerId",
      verifyUserToken,
      verifyRole("Owner"),
      async (req, res) => {
        const { ownerId } = req.params;

        if (req.query.page || req.query.limit) {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const skip = (page - 1) * limit;

          const query = { ownerId: ownerId };
          const totalBookings = await bookingsCollection.countDocuments(query);
          const totalPages = Math.ceil(totalBookings / limit);

          const result = await bookingsCollection
            .find(query)
            .skip(skip)
            .limit(limit)
            .toArray();

          return res.json({
            bookings: result,
            totalBookings,
            totalPages,
            currentPage: page,
          });
        }

        const result = await bookingsCollection
          .find({
            ownerId: ownerId,
          })
          .toArray();

        res.json(result);
      },
    );

    //---------     Property     ---------\\

    // All Properties Data for Admin
    app.get(
      "/all-properties/admin",
      verifyUserToken,
      verifyRole("Admin"),
      async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        const totalProperties = await propertiesCollection.countDocuments();
        const totalPages = Math.ceil(totalProperties / limit);

        const result = await propertiesCollection
          .find()
          .skip(skip)
          .limit(limit)
          .toArray();

        res.json({
          properties: result,
          totalProperties,
          totalPages,
          currentPage: page,
        });
      },
    );

    // ADD 1 Property
    app.post(
      "/all-properties",
      verifyUserToken,
      verifyRole("Owner"),
      async (req, res) => {
        const propertyData = req.body;
        const result = await propertiesCollection.insertOne(propertyData);
        res.json(result);
      },
    );

    // Update Property Data
    app.patch(
      "/all-properties/:propertyId",
      verifyUserToken,
      verifyRole("Admin", "Owner"),
      async (req, res) => {
        const { propertyId } = req.params;
        const propertyData = req.body;

        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(propertyId) },
          { $set: propertyData },
        );
        res.json(result);
      },
    );

    // Delete Property Data
    app.delete(
      "/all-properties/:propertyId",
      verifyUserToken,
      verifyRole("Admin", "Owner"),
      async (req, res) => {
        const { propertyId } = req.params;

        const result = await propertiesCollection.deleteOne({
          _id: new ObjectId(propertyId),
        });

        res.json(result);
      },
    );

    // (public) All Properties  (status: "Approved")
    app.get("/all-properties", async (req, res) => {
      try {
        const { search, propertyType, sort } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const query = { status: "Approved" };

        if (search) {
          query.location = { $regex: search, $options: "i" };
        }

        if (propertyType) {
          query.propertyType = propertyType;
        }

        let sortOptions = {};
        if (sort === "price-asc") {
          sortOptions.rentPrice = 1;
        } else if (sort === "price-desc") {
          sortOptions.rentPrice = -1;
        }

        const totalItems = await propertiesCollection.countDocuments(query);

        const properties = await propertiesCollection
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalPages = Math.ceil(totalItems / limit);

        res.json({
          properties,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            limit,
          },
        });
      } catch (error) {
        // console.error("Error fetching properties:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // (public) Featured Properties
    app.get("/featured-properties", async (req, res) => {
      const result = await propertiesCollection
        .find({ status: "Approved" })
        .limit(6)
        .toArray();

      res.json(result);
    });

    // Get Property by Property id
    app.get("/all-properties/:id", verifyUserToken, async (req, res) => {
      const { id } = req.params;

      const result = await propertiesCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    // Get Properties by ownerId
    app.get(
      "/owner-properties/:ownerId",
      verifyUserToken,
      verifyRole("Owner"),
      async (req, res) => {
        const { ownerId } = req.params;

        if (req.query.page || req.query.limit) {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const skip = (page - 1) * limit;

          const query = { "owner.id": ownerId };
          const totalProperties =
            await propertiesCollection.countDocuments(query);
          const totalPages = Math.ceil(totalProperties / limit);

          const result = await propertiesCollection
            .find(query)
            .skip(skip)
            .limit(limit)
            .toArray();

          return res.json({
            properties: result,
            totalProperties,
            totalPages,
            currentPage: page,
          });
        }

        const result = await propertiesCollection
          .find({
            "owner.id": ownerId,
          })
          .toArray();

        res.json(result);
      },
    );

    //---------     Review     ---------\\

    // Get Reviews by property id
    app.get("/all-reviews/:id", verifyUserToken, async (req, res) => {
      const { id } = req.params;

      const result = await reviewsCollection
        .find({
          propertyId: id,
        })
        .toArray();

      res.json(result);
    });

    // ADD 1 Review
    app.post(
      "/all-reviews",
      verifyUserToken,
      verifyRole("Tenant"),
      async (req, res) => {
        const review = req.body;
        const result = await reviewsCollection.insertOne(review);
        res.json(result);
      },
    );

    // (public) Get 4 good  tenant Reviews
    app.get("/home-reviews", async (req, res) => {
      const result = await reviewsCollection
        .find({
          rating: 5,
          role: "Tenant",
        })
        .limit(4)
        .toArray();

      res.json(result);
    });

    //---------     Favorites     ---------\\

    // Add to Favorites
    app.post(
      "/all-favorites",
      verifyUserToken,
      verifyRole("Tenant"),
      async (req, res) => {
        const favoritesData = req.body;
        const existing = await favoritesCollection.findOne({
          userId: favoritesData.userId,
          propertyId: favoritesData.propertyId,
        });

        if (existing) {
          return res.json({
            acknowledged: true,
            insertedId: existing._id,
            alreadyExists: true,
          });
        }

        const result = await favoritesCollection.insertOne(favoritesData);
        res.json(result);
      },
    );

    // Get favorites property by userId
    app.get(
      "/all-favorites/:id",
      verifyUserToken,
      verifyRole("Tenant"),
      async (req, res) => {
        const { id } = req.params;

        const result = await favoritesCollection
          .find({
            userId: id,
          })
          .toArray();

        res.json(result);
      },
    );

    // Delete 1 Favorite i by i Id
    app.delete(
      "/all-favorites/:itemId",
      verifyUserToken,
      verifyRole("Tenant"),
      async (req, res) => {
        const { itemId } = req.params;

        let query;
        if (ObjectId.isValid(itemId) && itemId.length === 24) {
          query = { _id: new ObjectId(itemId) };
        } else {
          query = { propertyId: itemId, userId: req.user?.id };
        }

        const result = await favoritesCollection.deleteOne(query);

        res.json(result);
      },
    );

    //----------------------------------------//
    //---------     Tracking     ---------\\

    app.post("/track/session", extractIdentity, async (req, res) => {
      // 1. Admin Exclusion
      if (req.user?.role === "Admin") {
        return res.json({ message: "Admin not tracked" });
      }

      const { sessionId, visitorId, entryPage, currentPage } = req.body;
      if (!sessionId || !visitorId) {
        return res.status(400).json({ error: "Missing tracking identifiers" });
      }

      // 2. Extract Data
      const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const rawUserAgent = req.headers["user-agent"] || "";
      const device = parseUserAgent(rawUserAgent);
      
      const geo = {
        country: req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || null,
        region: req.headers["x-vercel-ip-city-region"] || null,
        city: req.headers["x-vercel-ip-city"] || null,
      };

      const now = new Date();
      const userId = req.user?.id || null;
      const role = req.user?.role || "Guest";

      // 3. Upsert Session
      const existingSession = await trackingSessionsCollection.findOne({ sessionId });
      
      let routeHistory = existingSession ? (existingSession.routeHistory || []) : [];
      let newPageViewCount = existingSession ? existingSession.pageViewCount : 0;
      const startedAt = existingSession ? existingSession.startedAt : now;
      const sessionDurationMs = now.getTime() - new Date(startedAt).getTime();

      if (!existingSession) {
        newPageViewCount = 1;
        routeHistory.push({
          path: currentPage,
          enteredAt: now,
          leftAt: now,
          durationMs: 0
        });
      } else if (existingSession.currentPage !== currentPage) {
        newPageViewCount++;
        
        // Finalize previous route
        if (routeHistory.length > 0) {
          const lastRoute = routeHistory[routeHistory.length - 1];
          lastRoute.leftAt = now;
          lastRoute.durationMs = now.getTime() - new Date(lastRoute.enteredAt).getTime();
        }

        // Add new route
        if (routeHistory.length < 100) {
          routeHistory.push({
            path: currentPage,
            enteredAt: now,
            leftAt: now,
            durationMs: 0
          });
        }
      } else {
        // Same page heartbeat, update duration of current page
        if (routeHistory.length > 0) {
          const lastRoute = routeHistory[routeHistory.length - 1];
          lastRoute.leftAt = now;
          lastRoute.durationMs = now.getTime() - new Date(lastRoute.enteredAt).getTime();
        }
      }

      const updateDoc = {
        $set: {
          visitorId,
          userId,
          role,
          ipAddress,
          device,
          geo,
          currentPage,
          pageViewCount: newPageViewCount,
          routeHistory,
          lastActiveAt: now,
          sessionDurationMs,
          status: "active"
        },
        $setOnInsert: {
          sessionId,
          entryPage,
          startedAt: now
        }
      };

      await trackingSessionsCollection.updateOne(
        { sessionId },
        updateDoc,
        { upsert: true }
      );

      res.json({ success: true });
    });

    app.post("/track/event", extractIdentity, async (req, res) => {
      if (req.user?.role === "Admin") {
        return res.json({ message: "Admin not tracked" });
      }

      const { sessionId, visitorId, type, metadata } = req.body;
      if (!sessionId || !visitorId || !type) {
        return res.status(400).json({ error: "Missing event data" });
      }

      const userId = req.user?.id || null;
      const role = req.user?.role || "Guest";

      const eventDoc = {
        sessionId,
        visitorId,
        userId,
        role,
        type,
        metadata: metadata || {},
        createdAt: new Date()
      };

      await trackingActivitiesCollection.insertOne(eventDoc);
      res.json({ success: true });
    });

    // Admin Tracking Stats
    app.get("/admin/tracking-stats", verifyUserToken, verifyRole("Admin"), async (req, res) => {
      try {
        const threshold = new Date(Date.now() - 1 * 60 * 1000); // 1 minutes heartbeat threshold
        
        const activeSessions = await trackingSessionsCollection.find({
          status: "active",
          lastActiveAt: { $gte: threshold }
        }).toArray();

        let stats = {
          activeNow: activeSessions.length,
          guests: 0,
          tenants: 0,
          owners: 0
        };

        activeSessions.forEach(session => {
          if (session.role === "Guest") stats.guests++;
          else if (session.role === "Tenant") stats.tenants++;
          else if (session.role === "Owner") stats.owners++;
        });

        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Admin Tracking Sessions
    app.get("/admin/tracking-sessions", verifyUserToken, verifyRole("Admin"), async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { role, status, search } = req.query;
        let query = {};

        if (role && role !== "All") {
          query.role = role;
        }

        if (status && status !== "All") {
          if (status === "Active") {
            const threshold = new Date(Date.now() - 1 * 60 * 1000);
            query.status = "active";
            query.lastActiveAt = { $gte: threshold };
          } else if (status === "Inactive") {
            const threshold = new Date(Date.now() - 1 * 60 * 1000);
            query.$or = [
              { status: "inactive" },
              { lastActiveAt: { $lt: threshold } }
            ];
          }
        }

        if (search) {
          query.$or = [
            { visitorId: { $regex: search, $options: "i" } },
            { userId: { $regex: search, $options: "i" } },
            { ipAddress: { $regex: search, $options: "i" } }
          ];
        }

        const totalSessions = await trackingSessionsCollection.countDocuments(query);
        const totalPages = Math.ceil(totalSessions / limit);

        const sessions = await trackingSessionsCollection
          .find(query)
          .sort({ lastActiveAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        // Get user info for registered users to avoid duplication
        const validUserIds = sessions
          .filter(s => s.userId && ObjectId.isValid(s.userId))
          .map(s => new ObjectId(s.userId));
          
        let usersMap = {};
        if (validUserIds.length > 0) {
          const users = await usersCollection.find({ _id: { $in: validUserIds } }).project({ name: 1, email: 1, _id: 1 }).toArray();
          users.forEach(u => { usersMap[u._id.toString()] = u; });
        }
        
        const enrichedSessions = sessions.map(session => ({
          ...session,
          userInfo: session.userId && usersMap[session.userId] ? usersMap[session.userId] : null
        }));

        res.json({
          sessions: enrichedSessions,
          totalSessions,
          totalPages,
          currentPage: page
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Admin Tracking Activities for Session
    app.get("/admin/tracking-activities/:sessionId", verifyUserToken, verifyRole("Admin"), async (req, res) => {
      try {
        const { sessionId } = req.params;
        const activities = await trackingActivitiesCollection
          .find({ sessionId })
          .sort({ createdAt: 1 })
          .toArray();

        res.json(activities);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //----------------------------------------//
    // await client.db("admin").command({ ping: 1 });      //   <--- !
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Rent Ease Server is running...`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');

const cors = require('cors');
const dotenv = require('dotenv');
const { jwtVerify, createRemoteJWKSet } = require('jose-cjs');

const app = express();
app.use(
    cors({
        credentials: true,
        origin: [process.env.CLIENT_URL],
    }),
);
dotenv.config();

const uri = process.env.MONGODB_URI;

const PORT = process.env.PORT;
app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyUserToken = async (req, res, next) => {                 // Verify User
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    const userToken = authHeader.split(" ")[1];

    if (!userToken) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    try {
        const { payload } = await jwtVerify(userToken, JWKS);
        req.user = payload;

        next();
    } catch (error) {
        return res.status(403).json({
            message: "Token verification failed. Please log in again."
        });
    }
};

const verifyRole = (...roles) => {                                  // Verify Role ("Tenant", "Owner", "Admin")
    return (req, res, next) => {

        // console.log(req.user)
        if (!req.user) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Forbidden"
            });
        }

        next();
    };
};


async function run() {
    try {
        // await client.connect();                                  //   <--- !

        //---------   DB & COLLECTIONS   ---------\\
        const db = client.db('rent-ease');

        const propertiesCollection = db.collection('all-properties');
        const reviewsCollection = db.collection('all-reviews');
        const favoritesCollection = db.collection('all-favorites');
        const bookingsCollection = db.collection('all-bookings');
        const usersCollection = db.collection("user");


        //---------     API Endpoint     ---------\\

        //---------     User     ---------\\

        // All User
        app.get('/all-user', verifyUserToken, verifyRole("Admin"), async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.json(result);
        });

        // Update User Role
        app.patch("/all-user/:userId", verifyUserToken, verifyRole("Admin"), async (req, res) => {
            const { userId } = req.params;
            const userRole = req.body;

            const result = await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $set: userRole },
            );
            res.json(result);
        });



        //---------     Bookings     ---------\\

        // All Bookings Data
        app.get('/all-bookings', verifyUserToken, verifyRole("Admin"), async (req, res) => {
            const result = await bookingsCollection.find().toArray();
            res.json(result);
        });

        // ADD 1 booking
        app.post('/all-bookings', verifyUserToken, verifyRole("Tenant"), async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.json(result);
        });

        // Update Booking
        app.patch("/all-bookings/:bookingId", verifyUserToken, verifyRole("Owner", "Tenant"), async (req, res) => {
            const { bookingId } = req.params;
            const Data = req.body;

            // console.log(Data);
            const result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { $set: Data },
            );
            res.json(result);
        });

        // Get booking data by tenantId
        app.get('/tenant-bookings/:tenantId', verifyUserToken, verifyRole("Tenant"), async (req, res) => {
            const { tenantId } = req.params;

            const result = await bookingsCollection.find({
                tenantId: tenantId
            }).toArray();

            res.json(result);
        });

        // Get booking data by ownerId
        app.get('/owner-bookings/:ownerId', verifyUserToken, verifyRole("Owner"), async (req, res) => {
            const { ownerId } = req.params;

            const result = await bookingsCollection.find({
                ownerId: ownerId
            }).toArray();

            res.json(result);
        });



        //---------     Property     ---------\\

        // All Properties Data for Admin
        app.get('/all-properties/admin', verifyUserToken, verifyRole("Admin"), async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 15;
            const skip = (page - 1) * limit;

            const totalProperties = await propertiesCollection.countDocuments();
            const totalPages = Math.ceil(totalProperties / limit);

            const result = await propertiesCollection.find().skip(skip).limit(limit).toArray();

            res.json({
                properties: result,
                totalProperties,
                totalPages,
                currentPage: page
            });
        });

        // ADD 1 Property
        app.post('/all-properties', verifyUserToken, verifyRole("Owner"), async (req, res) => {
            const propertyData = req.body;
            const result = await propertiesCollection.insertOne(propertyData);
            res.json(result);
        });

        // Update Property Data
        app.patch("/all-properties/:propertyId", verifyUserToken, verifyRole("Admin", "Owner"), async (req, res) => {
            const { propertyId } = req.params;
            const propertyData = req.body;

            const result = await propertiesCollection.updateOne(
                { _id: new ObjectId(propertyId) },
                { $set: propertyData },
            );
            res.json(result);
        });

        // Delete Property Data
        app.delete("/all-properties/:propertyId", verifyUserToken, verifyRole("Admin", "Owner"), async (req, res) => {
            const { propertyId } = req.params;

            const result = await propertiesCollection.deleteOne({
                _id: new ObjectId(propertyId)
            });

            res.json(result);
        });

        // (public) All Properties  (status: "Approved")
        app.get('/all-properties', async (req, res) => {
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
                        limit
                    }
                });
            } catch (error) {
                // console.error("Error fetching properties:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // (public) Featured Properties
        app.get('/featured-properties', async (req, res) => {
            const result = await propertiesCollection.find({ status: "Approved" })
                .limit(6)
                .toArray();

            res.json(result);
        });

        // Get Property by Property id
        app.get("/all-properties/:id", verifyUserToken, async (req, res) => {
            const { id } = req.params;

            const result = await propertiesCollection.findOne({
                _id: new ObjectId(id)
            });

            res.json(result);
        });

        // Get Properties by ownerId
        app.get("/owner-properties/:ownerId", verifyUserToken, verifyRole("Owner"), async (req, res) => {
            const { ownerId } = req.params;

            const result = await propertiesCollection.find({
                "owner.id": ownerId
            }).toArray();

            res.json(result);
        });



        //---------     Review     ---------\\

        // Get Reviews by property id
        app.get("/all-reviews/:id", verifyUserToken, async (req, res) => {
            const { id } = req.params;

            const result = await reviewsCollection.find({
                propertyId: id
            }).toArray();;

            res.json(result);
        });

        // ADD 1 Review
        app.post('/all-reviews', verifyUserToken, verifyRole("Tenant"), async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
        });

        // (public) Get 4 good  tenant Reviews
        app.get("/home-reviews", async (req, res) => {
            const result = await reviewsCollection
                .find({
                    rating: 5,
                    role: "Tenant"
                })
                .limit(4)
                .toArray();

            res.json(result);
        });



        //---------     Favorites     ---------\\

        // Add to Favorites
        app.post('/all-favorites', verifyUserToken, verifyRole("Tenant"), async (req, res) => {
            const favoritesData = req.body;
            const result = await favoritesCollection.insertOne(favoritesData);
            res.json(result);
        });

        // Get favorites property by userId
        app.get("/all-favorites/:id", verifyUserToken, verifyRole("Tenant"), async (req, res) => {
            const { id } = req.params;

            const result = await favoritesCollection.find({
                userId: id
            }).toArray();;

            res.json(result);
        });

        // Delete 1 Favorite i by i Id
        app.delete("/all-favorites/:itemId", verifyUserToken, verifyRole("Tenant"), async (req, res) => {
            const { itemId } = req.params;

            const result = await favoritesCollection.deleteOne({
                _id: new ObjectId(itemId)
            });

            res.json(result);
        });



        //----------------------------------------//
        // await client.db("admin").command({ ping: 1 });      //   <--- !
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send(`Rent Ease Server is running...`)
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
});
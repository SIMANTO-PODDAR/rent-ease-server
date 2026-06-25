// const dns = require("node:dns");
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');

const cors = require('cors');
const dotenv = require('dotenv');
const { jwtVerify, createRemoteJWKSet } = require('jose-cjs');

const app = express();
app.use(cors());
dotenv.config();

const uri = process.env.MONGODB_URI;

const PORT = process.env.PORT || 5000;
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
        // await client.connect();                              //   <--- !

        //---------   DB & COLLECTIONS   ---------\\
        const db = client.db('rent-ease');
        const dbAuth = client.db('rent-ease-auth');

        const propertiesCollection = db.collection('all-properties');
        const reviewsCollection = db.collection('all-reviews');
        const favoritesCollection = db.collection('all-favorites');
        const bookingsCollection = db.collection('all-bookings');
        const usersCollection = dbAuth.collection("user");

        //---------     API Endpoint     ---------\\

        //---------     User     ---------\\
        app.get('/all-user', verifyUserToken, verifyRole("Admin"), async (req, res) => {                  // All User
            const result = await usersCollection.find().toArray();
            res.json(result);
        });

        app.patch("/all-user/:userId", verifyUserToken, verifyRole("Admin"), async (req, res) => {        // Update User Role
            const { userId } = req.params;
            const userRole = req.body;

            const result = await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $set: userRole },
            );
            res.json(result);
        });



        //---------     Bookings     ---------\\

        app.get('/all-bookings', verifyUserToken, verifyRole("Admin"), async (req, res) => {                   // All Bookings Data
            const result = await bookingsCollection.find().toArray();
            res.json(result);
        });

        app.post('/all-bookings', async (req, res) => {                  // ADD 1 booking
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.json(result);
        });

        app.patch("/all-bookings/:bookingId", async (req, res) => {      // Update Booking
            const { bookingId } = req.params;
            const Data = req.body;

            // console.log(Data);
            const result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { $set: Data },
            );
            res.json(result);
        });

        app.get('/tenant-bookings/:tenantId', async (req, res) => {      // Get booking data by tenantId
            const { tenantId } = req.params;

            const result = await bookingsCollection.find({
                tenantId: tenantId
            }).toArray();

            res.json(result);
        });

        app.get('/owner-bookings/:ownerId', async (req, res) => {        // Get booking data by ownerId
            const { ownerId } = req.params;

            const result = await bookingsCollection.find({
                ownerId: ownerId
            }).toArray();

            res.json(result);
        });



        //---------     Property     ---------\\
        app.get('/all-properties/admin', verifyUserToken, verifyRole("Admin"), async (req, res) => {           // All Properties Data for Admin
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

        app.post('/all-properties', async (req, res) => {                // ADD 1 Property
            const propertyData = req.body;
            const result = await propertiesCollection.insertOne(propertyData);
            res.json(result);
        });

        app.patch("/all-properties/:propertyId", verifyUserToken, verifyRole("Admin"), async (req, res) => {   // Update Property Data
            const { propertyId } = req.params;
            const propertyData = req.body;

            const result = await propertiesCollection.updateOne(
                { _id: new ObjectId(propertyId) },
                { $set: propertyData },
            );
            res.json(result);
        });

        app.delete("/all-properties/:propertyId", verifyUserToken, verifyRole("Admin"), async (req, res) => {  // Delete Property Data
            const { propertyId } = req.params;

            const result = await propertiesCollection.deleteOne({
                _id: new ObjectId(propertyId)
            });

            res.json(result);
        });

        app.get('/all-properties', async (req, res) => {            // All Properties  (status: "Approved")
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

        app.get('/featured-properties', async (req, res) => {       // Featured Properties
            const result = await propertiesCollection.find({ status: "Approved" })
                .limit(6)
                .toArray();

            res.json(result);
        });

        app.get("/all-properties/:id", async (req, res) => {        // Get Property by Property id
            const { id } = req.params;

            const result = await propertiesCollection.findOne({
                _id: new ObjectId(id)
            });

            res.json(result);
        });

        app.get("/owner-properties/:ownerId", async (req, res) => { // Get Properties by ownerId
            const { ownerId } = req.params;

            const result = await propertiesCollection.find({
                "owner.id": ownerId
            }).toArray();

            res.json(result);
        });



        //---------     Review     ---------\\
        app.get("/all-reviews/:id", async (req, res) => {           // Get Reviews by property id
            const { id } = req.params;

            const result = await reviewsCollection.find({
                propertyId: id
            }).toArray();;

            res.json(result);
        });

        app.post('/all-reviews', async (req, res) => {              // ADD 1 Review
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
        });

        app.get("/home-reviews", async (req, res) => {              // Get 4 good  tenant Reviews
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
        app.post('/all-favorites', async (req, res) => {            // Add to Favorites 
            const favoritesData = req.body;
            const result = await favoritesCollection.insertOne(favoritesData);
            res.json(result);
        });

        app.get("/all-favorites/:id", async (req, res) => {         // Get favorites property by userId
            const { id } = req.params;

            const result = await favoritesCollection.find({
                userId: id
            }).toArray();;

            res.json(result);
        });

        app.delete("/all-favorites/:itemId", async (req, res) => {  // Delete 1 Favorite i by i Id
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
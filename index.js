/** @format */

const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRETK_KEY);


app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;

	if (!authorization) {
		return res
			.status(404)
			.send({ err: true, message: "Unauthoriz Access blank authoriaza" });
	}
	const token = authorization.split(" ")[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_JWT, (err, decoded) => {
		if (err) {
			return res
				.status(401)
				.send({ err: true, message: "Unauthorizatin Accesss othr" });
		}
		req.decoded = decoded;
		next();
	});
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nvffntx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();

		const userCollection = client.db("bristoDB").collection("users");
		const menuCollection = client.db("bristoDB").collection("menu");
		const cartCollection = client.db("bristoDB").collection("carts");

		// verifyAdmin
		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			if (user?.role !== "admin") {
				return res
					.status(403)
					.send({ error: true, message: "Forbidden Access" });
			}
			next();
		};

		// jwt token api
		app.post("/jwt", (req, res) => {
			const userEmail = req.body;

			const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_JWT, {
				expiresIn: "1h",
			});

			res.send({ token });
		});

		// menu apis for all users
		app.get("/menu", async (req, res) => {
			const result = await menuCollection.find().toArray();
			res.send(result);
		});

		// TODO: check admin
		// add menu just admin
		app.post("/manu", verifyJWT, async (req, res) => {
			const newItem = req.body;
			const result = await menuCollection.insertOne(newItem);
			res.send(result);
		});

		// delete menu just for admin
		app.delete("/menu/:id", async (req, res) => {
			const id = req.params.id;

			const query = { _id: new ObjectId(id) };

			const getresult = await menuCollection.findOne(query);

			const result = await menuCollection.deleteOne(query);

			res.send(result);
		});

		// check admin or not
		app.get("/users/admin/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			const result = { admin: user?.role === "admin" };
			res.send(result);
		});

		// users apis just only admin to get USER
		app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
			const result = await userCollection.find().toArray();
			res.send(result);
		});

		// when user register
		app.post("/users", async (req, res) => {
			const saveUser = req.body;

			const query = { email: saveUser.email };

			const existUser = await userCollection.findOne(query);

			if (existUser) {
				return res.send({});
			}
			const result = await userCollection.insertOne(saveUser);
			res.send(result);
		});

		// make admin just onley ADMIN
		app.patch("/users/admin/:id", async (req, res) => {
			const id = req.params.id;

			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: `admin`,
				},
			};
			const result = await userCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		
		// TODO: check forbidden
		// get loogin user's carts
		app.get("/carts", verifyJWT, async (req, res) => {
			const email = req.query.email;
			const query = { email: email };
			const result = await cartCollection.find(query).toArray();
			res.send(result);
		});

		app.post("/carts", async (req, res) => {
			const body = req.body;
			const result = await cartCollection.insertOne(body);
			res.send(result);
		});

		// item delete any logged user
		app.delete("/carts/:id", async (req, res) => {
			const id = req.params.id;

			const query = { _id: new ObjectId(id) };
			const result = await cartCollection.deleteOne(query);
			res.send(result);
		});


		app.post("/create-payment-intent", async (req, res) => {
			const { price } = req.body;
			const amount = price * 100;

			// Create a PaymentIntent with the order amount and currency
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: "usd",
				payment_method_types: ["card"]
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});







		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("Bristo Server running...");
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});

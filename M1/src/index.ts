import express from "express";
import amqp from "amqplib";
import fs from "fs";

type Message = {
    id?: number;
    text: string;
}

const queueName = "rpc-queue";
const logPath = "./.log";

async function main() {
    log("===== Starting microservice M1 =====");

    const app = express();
    const PORT = 4444;
    app.use(express.json());

    // Handle for the /send route
    app.post("/send", async (req, res) => {
        log("----- Got an HTTP request -----");

        // Checking for request validity
        if (req.headers["content-type"] !== "application/json") {
            log("Invalid headers in request");

            res.statusCode = 400;
            res.send("Content-Type must be application/json");
            return;
        }

        // Ideally it would also check for correct body structure, but for now it's fine
        const body: Message = req.body;

        // Trying to connect to the main queue as well as create an exclusive one
        let connection: amqp.Connection;
        let channel: amqp.Channel;
        let reply: amqp.Replies.AssertQueue;

        log("Connecting to RabbitMQ");
        try {
            connection = await amqp.connect("amqp://localhost:5672");
            channel = await connection.createChannel();
            await channel.assertQueue(queueName);
            reply = await channel.assertQueue("", { exclusive: true });
        } catch(err) {
            log("Failed to connect to RabbitMQ");
            log(err);

            res.statusCode = 500;
            res.send("Internal error");
            return;
        }
        log("Connected to RabbitMQ");

        // Getting a unique id for this request
        const correlationId = generateId();
        let gotResponse = false;

        // Setting a 10 second timeout so that the connection isn't open forever
        setTimeout(() => {
            if (!gotResponse) {
                log("Response with id " + correlationId + " timed out");
                res.statusCode = 500;
                res.send("Internal error");
            }
            channel.close();
            connection.close();
        }, 10000);

        // Waiting for a response
        log("Waiting for a response with id " + correlationId);
        channel.consume(reply.queue, (data) => {
            if (data.properties.correlationId === correlationId) {
                gotResponse = true;
                log("Got a response with id " + correlationId);
                res.json(JSON.parse(data.content.toString()));
                log("Sent the response");
            }
        }, { noAck: true });

        // Sending the message to RabbitMQ
        channel.sendToQueue(
            queueName, Buffer.from(JSON.stringify(body)),
            { correlationId: correlationId, replyTo: reply.queue }
        );
        log("Sent the request to " + queueName);
    });

    app.listen(PORT, () => {
        log("Server is listening on port " + PORT);
    });
}

// Ideally the function would also check for existing ids to avoid potential collision, but it's fine for now
function generateId() {
    let id = "";
    for (let i = 0; i < 5; i++) {
        id += Math.floor(Math.random() * 9) + 1;
    }
    return id;
}

// Outputs with console.log and appends to the log file
function log(message?: any) {
    const currTime = getCurrTime();
    message = `[${currTime}]: ${message}`;

    console.log(message);

    fs.appendFile(logPath, message + "\n", (err) => {
        if (err) {
            console.log("Could not append the above message to log");
            console.log(err);
        }
    });
}

function getCurrTime(): string {
    const d = new Date();
    const date =
        d.getUTCFullYear() + "/" +
        (((d.getUTCMonth() + 1) < 10) ? "0" : "") + (d.getUTCMonth() + 1) + "/" +
        ((d.getUTCDate() < 10) ? "0" : "") + d.getUTCDate();
    const time =
        ((d.getUTCHours() < 10) ? "0" : "") + d.getUTCHours() + ":"
        + ((d.getUTCMinutes() < 10) ? "0" : "") + d.getUTCMinutes() + ":"
        + ((d.getUTCSeconds() < 10) ? "0" : "") + d.getUTCSeconds();
    return date + " " + time;
}

main();

import amqp from "amqplib";
import fs from "fs";

type Message = {
    id?: number;
    text: string;
}

const queueName = "rpc-queue";
const logPath = "./.log";

let connection: amqp.Connection;
let channel: amqp.Channel;
let lastId = 0;

async function main() {
    log("===== Starting microservice M2 =====");

    log("Connecting to " + queueName);
    try {
        connection = await amqp.connect("amqp://localhost:5672");
        channel = await connection.createChannel();
        await channel.assertQueue(queueName);
    } catch(err) {
        log("Failed to connect to " + queueName);
        log(err);
        return;
    }
    log("Connected to " + queueName);

    channel.prefetch(1);
    log("Waiting for requests");

    // Waiting for a request
    channel.consume(queueName, (data) => {
        log("----- Got a message task -----");
        log("Request id is " + data.properties.correlationId);

        // Do whatever with the data, as an example i am just assigning an id here
        let parsed: Message = JSON.parse(data.content.toString());
        parsed.id = lastId;
        lastId++;

        // Offsetting the rest of the task by 2 seconds to simulate a heavy operation
        setTimeout(() => {
            // Send it back
            channel.sendToQueue(
                data.properties.replyTo,
                Buffer.from(JSON.stringify(parsed)),
                { correlationId: data.properties.correlationId }
            );

            channel.ack(data);
            log("Finished the task");
        }, 2000);
    });
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

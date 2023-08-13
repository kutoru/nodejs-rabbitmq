# What does the project do
It waits for POST requests (see the [Using](#using) section), assigns an id to the request's content and responds with the result.

# Running the project
### Prerequisites
You will need Docker and NodeJS installed on your system.
### Setting up
For both microservices:
1. `cd` into the respective microservise directory
1. Install dependencies with `npm i`
1. Build with `npm run build`
### Running
1. Run RabbitMQ with
    ```
    docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3.9.29-management
    ```
1. Run both microservices with `node build/index.js` in their respective directories

# Using
Make POST requests to `localhost:4444/send` with the following format:
```json
{
    "text": "Some random text"
}
```
And wait 2 seconds for each response (I intentionally set a timeout to test the queue).

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(functions.config().stripe.secret_key);

// PayPal SDK setup
const paypal = require('@paypal/checkout-server-sdk');

// Set up PayPal environment
// This uses your PayPal sandbox credentials. For live, use new paypal.core.LiveEnvironment(clientId, clientSecret);
const environment = new paypal.core.SandboxEnvironment(
  functions.config().paypal.client_id,
  functions.config().paypal.client_secret
);
const paypalClient = new paypal.core.PayPalHttpClient(environment);

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the ARTBurim Gallery API!');
});

// Stripe payment intent creation
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, paymentMethodId } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      payment_method: paymentMethodId,
      confirm: true,
      return_url: 'https://your-domain.com/thank-you.html',
    });

    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Error creating Stripe payment intent:', error);
    res.status(500).send({ error: error.message });
  }
});

// PayPal order creation
app.post('/create-paypal-order', async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      application_context: {
        return_url: 'https://your-domain.com/thank-you.html', // Replace with your actual return URL
        cancel_url: 'https://your-domain.com/cancel.html', // Replace with your actual cancel URL
      },
    });

    const order = await paypalClient.execute(request);
    res.status(200).send({ orderID: order.result.id });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    res.status(500).send({ error: error.message });
  }
});

// PayPal order capture
app.post('/capture-paypal-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.prefer('return=representation');

    const capture = await paypalClient.execute(request);
    res.status(200).send({ status: capture.result.status });
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    res.status(500).send({ error: error.message });
  }
});

exports.api = functions.https.onRequest(app);

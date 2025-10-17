import e from "express";
import shopify from "../shopify.js";

export const getSession = async (shop) => {
  try {
    const sessions = await shopify.config.sessionStorage.findSessionsByShop(
      shop
    );
    if (!sessions || sessions.length === 0) {
      throw new Error(`No active session found for shop: ${shop}`);
    }
    return sessions[0];
  } catch (error) {
    console.log(error.message)
    throw new Error(error.message);
  }
};

export const getShopOwnerEmailAddress = async (session) => {
  try {
    const client = new shopify.api.clients.Graphql({ session });

    const response = await client.query({
      data: {
        query: `
      {
        shop {
          email
          shopOwnerName
          name
        }
      }
    `,
      },
    });

    const shopData = response.body.data.shop;
    return {
      email: shopData.email,
      shopOwner: shopData.shopOwnerName,
      name: shopData.name,
    };
  } catch (error) {
    throw new Error(
      error.message || "Failed to retrieve shop owner email address"
    );
  }
};

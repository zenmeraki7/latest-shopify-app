export const graphqlProductsAllFieldQuery = `{
  products {
    edges {
      node {
        id
        title
        productType
        handle
        tags
        category {
          fullName
        }
        featuredMedia {
          preview {
            image {
              url
              altText
            }
          }
        }
        seo {
          description
          title
        }
      }
    }
  }
}
`;

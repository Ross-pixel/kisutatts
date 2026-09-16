export function gql(strings, ...args) {
  let str = "";
  strings.forEach((string, i) => {
    str += string + (args[i] || "");
  });
  return str;
}
export const FlashDesignsPartsFragmentDoc = gql`
    fragment FlashDesignsParts on FlashDesigns {
  __typename
  title
  price
  category
  image
  description
}
    `;
export const OnSkinWorksPartsFragmentDoc = gql`
    fragment OnSkinWorksParts on OnSkinWorks {
  __typename
  title
  category
  image
  description
}
    `;
export const PortfolioPartsFragmentDoc = gql`
    fragment PortfolioParts on Portfolio {
  __typename
  title
  category
  price
  image
  description
}
    `;
export const FlashDesignsDocument = gql`
    query flashDesigns($relativePath: String!) {
  flashDesigns(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...FlashDesignsParts
  }
}
    ${FlashDesignsPartsFragmentDoc}`;
export const FlashDesignsConnectionDocument = gql`
    query flashDesignsConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: FlashDesignsFilter) {
  flashDesignsConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...FlashDesignsParts
      }
    }
  }
}
    ${FlashDesignsPartsFragmentDoc}`;
export const OnSkinWorksDocument = gql`
    query onSkinWorks($relativePath: String!) {
  onSkinWorks(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...OnSkinWorksParts
  }
}
    ${OnSkinWorksPartsFragmentDoc}`;
export const OnSkinWorksConnectionDocument = gql`
    query onSkinWorksConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: OnSkinWorksFilter) {
  onSkinWorksConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...OnSkinWorksParts
      }
    }
  }
}
    ${OnSkinWorksPartsFragmentDoc}`;
export const PortfolioDocument = gql`
    query portfolio($relativePath: String!) {
  portfolio(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...PortfolioParts
  }
}
    ${PortfolioPartsFragmentDoc}`;
export const PortfolioConnectionDocument = gql`
    query portfolioConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: PortfolioFilter) {
  portfolioConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...PortfolioParts
      }
    }
  }
}
    ${PortfolioPartsFragmentDoc}`;
export function getSdk(requester) {
  return {
    flashDesigns(variables, options) {
      return requester(FlashDesignsDocument, variables, options);
    },
    flashDesignsConnection(variables, options) {
      return requester(FlashDesignsConnectionDocument, variables, options);
    },
    onSkinWorks(variables, options) {
      return requester(OnSkinWorksDocument, variables, options);
    },
    onSkinWorksConnection(variables, options) {
      return requester(OnSkinWorksConnectionDocument, variables, options);
    },
    portfolio(variables, options) {
      return requester(PortfolioDocument, variables, options);
    },
    portfolioConnection(variables, options) {
      return requester(PortfolioConnectionDocument, variables, options);
    }
  };
}
import { createClient } from "tinacms/dist/client";
const generateRequester = (client) => {
  const requester = async (doc, vars, options) => {
    let url = client.apiUrl;
    if (options?.branch) {
      const index = client.apiUrl.lastIndexOf("/");
      url = client.apiUrl.substring(0, index + 1) + options.branch;
    }
    const data = await client.request({
      query: doc,
      variables: vars,
      url
    }, options);
    return { data: data?.data, errors: data?.errors, query: doc, variables: vars || {} };
  };
  return requester;
};
export const ExperimentalGetTinaClient = () => getSdk(
  generateRequester(
    createClient({
      url: "http://localhost:4001/graphql",
      queries
    })
  )
);
export const queries = (client) => {
  const requester = generateRequester(client);
  return getSdk(requester);
};

/**
 * Type representing the supported network IDs for the Mina Protocol.
 *
 * Currently supports:
 * - `"devnet"`: The Mina local blockchain and devnet
 * - `"mainnet"`: The Mina mainnet
 */
export type SupportedNetworkId = "devnet" | "mainnet";

/**
 * An object containing the verification keys for the NFT Collection and NFT contracts on different networks.
 *
 *
 * @remarks
 * The `NFTVerificationKeys` object maps a `SupportedNetworkId` to the corresponding verification keys for the NFT Collection and NFT contracts.
 *
 * **Structure:**
 * - `network`: The network identifier (`"devnet"` or `"mainnet"`).
 *   - `collection`:
 *     - `hash`: The hash of the verification key for the NFT Collection contract.
 *     - `data`: The verification key data for the NFT Collection contract.
 *   - `nft`:
 *     - `hash`: The hash of the verification key for the NFT contract.
 *     - `data`: The verification key data for the NFT contract.
 *
 * @example
 * Accessing the verification key hash for the NFT Collection on testnet:
 * ```typescript
 * const testnetCollectionVKHash = NFTVerificationKeys["devnet"].collection.hash;
 * ```
 */
export const nftVerificationKeys: {
  [key in "mainnet" | "devnet"]: {
    o1js: string;
    vk: {
      [key: string]: {
        hash: string;
        data: string;
        type: "nft";
      };
    };
  };
} = {
  devnet: {
    o1js: "2.2.0",
    vk: {
      NFT: {
        hash: "11840382732064931640435917684245815329181717734233274982467687213333743677377",
        data: "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",
        type: "nft",
      },
    },
  },
  mainnet: {
    o1js: "2.2.0",
    vk: {
      NFT: {
        hash: "11510318025893859422482952918693907155880273225165466507725691048640041393360",
        data: "AADUTaZ5kJK+C2TL7P/tc4MlgEq5zWOLFDtgDU/u9ry3Es1Ek79TcLqIWg8s6TJJcXzM0D/6xz1y8FQn2tGjjcspfNtNRAmG3FdldAatVpnkTwS6Otpm88gl7lOPX8bRJjhHfEtdvEsQ0OudcDzB5iCqu268zqkBvXrXT3xaNN+sIIqLTtxltMz4RS/2layxzL6mg1J+kkTsNIJsg6MufeMI6Xn5pAYOaWFqgo0N0WZsnF3EYcYq1LcDucyyFS2RqRninioewrlEDzjY8y6rmf9+GibQasJCE+mkbfB4wCOuFMiSrRIN/73BODz9siBxs/bU/p7xffJsOL8JvitK7ngRyG3PfGGdW22njv9MYxNhb/YhKnPA0qPTOQjxg1a/Pg8NyjB9RM7eypPJNLFaWFzNM4JRxjI7wGVVOfE0D7DUAL32SzQ1Jmr4mILqDhnDREu2ETq0Lb+c1cxPgb4x1nYbWcSgdAOtKJBvXHkWs7JlJdL1q9yiRrzYb1kPMPNGACnSB3N3Omm//FhxitOOM4yucxZyKpKst/otZu51/gGBDW5tIwKYpfl5ETSNvDFY+9rLUHv+LxSz+yq6cUFKExI6ABJGVQIttGyzKa3Doe/+kpSGbzsRpZXKazfH+jVQ57wbyfqQ7ah1/B7+xVngjYkK0IrpReCAaiIa0X1KE7EaoxWavhgVmpC5Q7SrwYYPkqb/HBWsxMcdrB842bKWsszzPYQxR6cfCwjXzq9Txe7fh1bzOKY6WO7ysYpefFM+yY85IlYCzX1/97FEaPGF4lBMe2ONgwPMq3VJ6Yxzfnor4zPMyH1pW2dm2QmV0Ep2NYO7fVGPn83abwq34GMgZmriFh3M7XzlYX54q3CeG861Z+HPZHukv+oVlUyWtWGk4E4PNlm61kXaLF7ECDy2+s73Ris1HbVSbbCOMkAok4Ytwi0FGwrSFSvRbb7s5Mbnfg6zvkKYwbNMjff5OlJPUcK5GMaYp2Ii2+7t+j3Wx8wSwdqlat61zS/PuZtaxiT0DL8+cvw1ZWa07udipKaQ8EJsdTHLvKFo6ZztCTnZronL4gTBR3T/N7QP1YPvN/TI7pZmkSwKLV3Zeq2uW494v4ysCf4qagVlrz1sfK6jvfUhMyfbzw9HMaqoNUhpUBBAGL0ANiuU1TSrzuTA/DdXpWrGvpxht97OQ+FDB3Bfc9qfITmDHeZijuM3U31QTU555rWwJ48EWT4y8Wmh84sEIrEUFDA9GS8I+Rgl5eE6QsQm09cJ2/FTzuIf2ps4+WcWf20huAyxrUOJxM1alZvTDTcAY9GPkPnFqQ46Uuch5x0k1Q1sxkgplNx2+uE6xGFUloYB5DKDdApgafJbVZ5YBrghBstiDkOVkOPTsRWM9BbJB5A4Ult8q4V+rNyRmqyyzOMhYEW2kj8yWr5CImCBZW0QPHzBXr/xZCcUH2VBZMKMqCly/9VkHR5LlMGgG5UlibSkoZvI2EOl1pFPW7F9dZ6JM18zW3VHNNM4W1drrTxbta0wX2Hp6lmtmOPOxjvYSrQiLBSFvouZ29tALODGK+21jErmEUoMJsRiRS6/cIkErD1tSO4qe86XPXYQ5niN34QsGWawOmVJIXoobD9vEvJHGpylpTg5i4HXBZu31nN/bezAQ0bp0k5k2iI4jo91gFoPItUXpBk2rLNZHMUhZOKT81yhJLnE5ihfrTQLgplzqRo7Dc7lQdohdyvzCi8Bxx/beoojY0ixWBVAw5bWK9/5KjImxG/2c38hBZ+2QYS/el2BEMe8mBUJqQ6bn/wVKngn6KsXEuIHf4Fs4JRA3xbWwP/9jrxFzYJ9pOW4ehETRBneHurW/1Myw/sOAebVzbhcEMVYeg2x4S2bgFHRteOBKgAkwfQFD/kvT+Cj6cYKcFgAQchhccMvUYC7IHdFFJ1vBRbWpWKwrXMrpXhP9R0/jhiIDG9iEYdRcW2Gc8SoxEMYa4Yp6VK1DaZ8X4YG1x6tVj/KLG+MoA7S9SoHhnNacyJJboJiczKR2kWcZswBrCughfCRlonVt+xj7zQeVyyaKql/9PHQKj49dpZYAeMtkq3k1P6Q/ivGrXXJ3y2ktO0usnVat5iQ7Q4Gi2Dvbpvm72q0bAeZDvlH4QTmFzJ0wApj1zXt1XK2z1nA9RSH7f6sI5JskSLQlnXfdUEW52vnOTGE4uZK2P4g5YlAiAVddmI0zGXoamMWlv9MaDFHKlcJtA9IZZZeC+cLzWhE177Y6VXumacpK7i70LwRR9ghnykqf5SuYTzlAVLaufgsR0LDwNStGwrF6JtPMsoD9DVNKrpQ+tNNUfYovOM1iwk2BXvz9BydiqZzFhmfIYXSkScpVvuThbsPxBZ1LqfCaX4f5Rz28GZILf0d9xPjsWFSCRk=",
        type: "nft",
      },
    },
  },
};

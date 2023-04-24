
# MetaPlex Candy Machine


This is a Metaplex candy machine UI project that can connect to a Phantom wallet and mint an NFT. You pay using AmberleyTech custom SPL token. Each NFT costs 4 AMB tokens.


**Candy Machine ID**: 9S2qUiHXnuNZXMX2H8DZXBV3rQeLZ9Z6MndCdCYptjqk

**AMB spl token mint address**: BNCwCAUQnt396Jwd87XzV4dADUnAUgTqNnh6Qqh9tdpi

Token account for this candy machine is my phantom wallet account. 

I'm linking candy machine project that was used to deploy this candy machine below

https://github.com/kranthicodes/module2-candymachine 

## Description

This project has been built using React and it interacts with a deployed Candy machine project with the help of `@solana/web3.js` `@solana/spl-token` `@project-serum/anchor` packages. The UI uses Tailwind css for styling.

## Getting Started

### Working with this project

To run this project, clone this repo and open terminal in the cloned folder. Run `yarn install` to install all the dependencies. 

Once you installed the dependencies, use the command `yarn start` to launch the UI locally.
Make sure to use your own candy machine ID in the `.env` file.

**Connect Phantom Wallet**

Once you run the UI you should see a button that will ask you to Connect with phantom wallet. In case the wallet is not found you will see a `Get Phantom` button which redirects you to chrome web store to install Phantom.

<img width="800" alt="Screenshot 2023-04-24 at 3 10 45 PM" src="https://user-images.githubusercontent.com/57343520/233962160-f54f5a50-9d88-477e-8d7f-0b4f7e522e5a.png">


**Mint NFT**

Once you're connected to the Dapp with your Phantom wallet, you should see `Mint` button depending on Candy Machine state. The button will be disabled if:

- All NFTs are minted (Sold Out)
- Candy Machine is not active or not found
- you dont have enough AMB tokens to mint


## Authors

  

Sai Kranthi

[@iamsaikranthi](https://twitter.com/iamsaikranthi)

  
  

## License

  

This project is licensed under the MIT License - see the LICENSE.md file for details

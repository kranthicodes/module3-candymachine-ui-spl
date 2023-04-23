import React from "react";
import { PublicKey } from "@solana/web3.js";

export default function useWallet(connection) {
  const [walletExists, setWalletExists] = React.useState(false);
  const [walletAddress, setWalletAddress] = React.useState(null);
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [tokenBalance, setTokenBalance] = React.useState(0);

  React.useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletExists();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  const checkIfWalletExists = async () => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          console.log("Phantom wallet found!");
          setWalletExists(true);
        }
      } else {
        alert("Solana object not found! Get a Phantom Wallet 👻");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const connectWallet = async () => {
    if (!walletExists) {
      window.open(
        "https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa?hl=en",
        "_blank"
      );
    }
    const { solana } = window;

    if (solana) {
      const response = await solana.connect();
      const balance = await getBalance(response.publicKey);
      await getTokenBalance(response.publicKey);

      console.log("Connected with Public Key:", response.publicKey.toString());
      console.log("Connected wallet balance:", balance);
      setWalletAddress(response.publicKey.toString());
      setWalletBalance(balance);
    }
  };

  const getBalance = async (pubKey) => {
    const balance = await connection.getBalance(new PublicKey(pubKey));

    return balance;
  };

  const getTokenBalance = async (pubKey) => {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(pubKey),
      {
        mint: new PublicKey("BNCwCAUQnt396Jwd87XzV4dADUnAUgTqNnh6Qqh9tdpi"),
      }
    );

    if (tokenAccounts.value.length > 0) {
      const tokenBal =
        tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;

      setTokenBalance(tokenBal);
    }

    // return balance;
  };

  const disconnectWallet = async () => {
    setWalletAddress(null);
  };

  return {
    walletExists,
    walletAddress,
    walletBalance,
    tokenBalance,
    connectWallet,
    disconnectWallet,
    getBalance,
    getTokenBalance,
  };
}

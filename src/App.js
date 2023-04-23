import React from "react";
import { Connection } from "@solana/web3.js";
import { Toaster } from "react-hot-toast";

import "./App.css";
import Header from "./components/Header";
import useWallet from "./hooks/useWallet";
import ConnectButton from "./components/ConnectButton";
import useCandyMachine from "./hooks/useCandyMachine";
import MintButton from "./components/MintButton";

function App() {
  const connection = new Connection(process.env.REACT_APP_RPC, "confirmed");

  const {
    walletAddress,
    walletBalance,
    walletExists,
    tokenBalance,
    connectWallet,
  } = useWallet(connection);

  const {
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining,
    isMinting,
    isValidBalance,
    isActive,
    candyMachine,
    mintToken,
  } = useCandyMachine(connection, walletAddress);

  return (
    <div className="bg-[#1C1C1C] flex flex-col h-screen">
      <Header
        walletAddress={walletAddress}
        walletBalance={walletBalance}
        tokenBalance={tokenBalance}
      />
      <div className="flex flex-row justify-center">
        <h1 className="bg-gradient-to-r from-amber-500 text-5xl to-pink-500 bg-clip-text text-transparent tracking-wide py-16">
          NUMBER NFT MINT
        </h1>
      </div>
      <div className="relative isolate flex flex-row justify-center pt-16">
        <div className="w-96 gap-20 rounded-lg flex flex-col justify-between bg-[#26262c] py-12 px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-row justify-between">
              <p className="text-xl">Total Items</p>
              <p className="text-xl">{itemsAvailable}</p>
            </div>
            <div className="flex flex-row justify-between">
              <p className="text-xl">Items Available</p>
              <p className="text-xl">
                {itemsRemaining}/{itemsAvailable}
              </p>
            </div>
            <div className="flex flex-row justify-between">
              <p className="text-xl">Items Redeemed</p>
              <p className="text-xl">
                {itemsRedeemed}/{itemsAvailable}
              </p>
            </div>
          </div>
          <div className="flex flex-row justify-center">
            {!walletAddress ? (
              <ConnectButton
                walletExists={walletExists}
                connectWallet={connectWallet}
              />
            ) : (
              <MintButton
                isSoldOut={candyMachine?.state.isSoldOut}
                isActive={isValidBalance || isActive}
                isMinting={isMinting}
                mintToken={mintToken}
              />
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default App;

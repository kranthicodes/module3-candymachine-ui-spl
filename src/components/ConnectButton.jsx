import React from "react";

export default function Connect({ walletExists, connectWallet }) {
  if (walletExists) {
    return (
      <span
        onClick={connectWallet}
        className="cursor-pointer flex justify-center items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-8 py-2 w-48 text-lg"
      >
        <img src="/phantom-icon-purple.png" className="w-6 h-6" />
        Connect
      </span>
    );
  }

  return (
    <span
      onClick={connectWallet}
      className="cursor-pointer flex justify-center items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-8 py-2 w-56 text-lg"
    >
      <img src="/phantom-icon-purple.png" className="w-6 h-6" />
      Get Phantom
    </span>
  );
}

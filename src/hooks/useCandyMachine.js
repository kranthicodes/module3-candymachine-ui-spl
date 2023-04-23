import React from "react";
import { Program, AnchorProvider, web3, BN } from "@project-serum/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Buffer } from "buffer";
import toast from "react-hot-toast";

import {
  CANDY_MACHINE_PROGRAM,
  TOKEN_METADATA_PROGRAM_ID,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  getAtaForMint,
  getNetworkExpire,
  getNetworkToken,
  getCollectionPDA,
  CIVIC,
  getCandyMachineState,
  createAccountsForMint,
  mint as mintNFT,
  awaitTransactionSignatureConfirmation,
} from "../utils/helpers";
import { sendTransactions } from "../utils/connection";

export default function useCandyMachine(connection, userWallet) {
  const [candyMachineState, setCandyMachineState] = React.useState(null);
  const [itemsAvailable, setItemsAvailable] = React.useState(0);
  const [itemsRedeemed, setItemsRedeemed] = React.useState(0);
  const [itemsRemaining, setItemsRemaining] = React.useState(0);
  const [isValidBalance, setIsValidBalance] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);

  const [isMinting, setIsMinting] = React.useState(false);
  const [needTxnSplit, setNeedTxnSplit] = React.useState(true);
  const [setupTxn, setSetupTxn] = React.useState(null);
  let toastId;

  React.useEffect(() => {
    if (userWallet) {
      toastId = toast.loading("Getting things ready...");
      fetchCandyMachine(userWallet);
    }
  }, [userWallet]);

  const getProvider = () => {
    const provider = new AnchorProvider(connection, window.solana);

    return provider;
  };

  const fetchCandyMachine = async (
    userWalletPubKey,
    commitment = "confirmed"
  ) => {
    const connection = new Connection(process.env.REACT_APP_RPC, commitment);
    userWalletPubKey = new web3.PublicKey(userWalletPubKey);

    const candyMachine = await getCandyMachineState(
      window.solana,
      new PublicKey(process.env.REACT_APP_CANDY_MACHINE_ID),
      connection
    );

    console.log("Candy machine state: ", candyMachine);

    let active = true;
    let userPrice = candyMachine.state.price;

    if (candyMachine?.state.tokenMint) {
      // retrieves the SPL token
      const mint = candyMachine.state.tokenMint;
      const token = (await getAtaForMint(mint, userWalletPubKey))[0];
      console.log(token.toString());
      try {
        const balance = await connection.getTokenAccountBalance(token);

        console.log({ balance });

        const valid = new BN(balance.value.amount).gte(userPrice);

        // only allow user to mint if token balance >  the user if the balance > 0
        setIsValidBalance(valid);
        active = active && valid;
      } catch (e) {
        setIsValidBalance(false);
        active = false;
        // no whitelist user, no mint
        console.log("There was a problem fetching SPL token balance");
        console.log(e);
      }
    } else {
      const balance = new BN(await connection.getBalance(userWalletPubKey));
      const valid = balance.gte(userPrice);
      setIsValidBalance(valid);
      active = active && valid;
    }

    if (candyMachine.state.isSoldOut) {
      active = false;
    }

    const [collectionPDA] = await getCollectionPDA(
      new PublicKey(process.env.REACT_APP_CANDY_MACHINE_ID)
    );
    const collectionPDAAccount = await connection.getAccountInfo(collectionPDA);

    setIsActive((candyMachine.state.isActive = active));
    setCandyMachineState(candyMachine);

    const txnEstimate =
      892 +
      (!!collectionPDAAccount && candyMachine.state.retainAuthority ? 182 : 0) +
      (candyMachine.state.tokenMint ? 66 : 0) +
      (candyMachine.state.whitelistMintSettings ? 34 : 0) +
      (candyMachine.state.whitelistMintSettings?.mode?.burnEveryTime ? 34 : 0) +
      (candyMachine.state.gatekeeper ? 33 : 0) +
      (candyMachine.state.gatekeeper?.expireOnUse ? 66 : 0);

    setNeedTxnSplit(txnEstimate > 1230);

    setItemsAvailable(candyMachine.state.itemsAvailable);
    setItemsRedeemed(candyMachine.state.itemsRedeemed);
    setItemsRemaining(candyMachine.state.itemsRemaining);

    toastId &&
      setTimeout(() => {
        toast.dismiss(toastId);
      }, 2000);
  };

  const mintToken = async () => {
    const userWalletPubKey = new PublicKey(userWallet);

    try {
      setIsMinting(true);
      let setupMint;

      if (needTxnSplit && setupTxn === undefined) {
        setupMint = await createAccountsForMint(
          candyMachineState,
          userWalletPubKey
        );
        let status = { err: true };
        if (setupMint.transaction) {
          status = await awaitTransactionSignatureConfirmation(
            setupMint.transaction,
            60000,
            connection,
            true
          );
        }
        if (status && !status.err) {
          setSetupTxn(setupMint);
        } else {
          console.error("Minting failed");
          setIsMinting(false);
          return;
        }
      }

      const mintResult = await mintNFT(
        candyMachineState,
        userWalletPubKey,
        [],
        [],
        setupMint ?? setupTxn
      );

      let status = { err: true };
      let metadataStatus = null;

      if (mintResult) {
        status = await awaitTransactionSignatureConfirmation(
          mintResult.mintTxId,
          60000,
          connection,
          true
        );

        metadataStatus =
          await candyMachineState.program.provider.connection.getAccountInfo(
            mintResult.metadataKey,
            "processed"
          );
        console.log("Metadata status: ", !!metadataStatus);
      }

      if (status && !status.err && metadataStatus) {
        const remaining = itemsRemaining - 1;
        setItemsRemaining(remaining);
        setIsActive((candyMachineState.state.isActive = remaining > 0));
        candyMachineState.state.isSoldOut = remaining === 0;
        setSetupTxn(undefined);

        fetchCandyMachine(userWalletPubKey, "processed");
        toast.success("Mint Successful!");
      } else if (status && !status.err) {
        toast.error("Mint likely failed! Check the explorer to confirm.");

        fetchCandyMachine(userWalletPubKey);
      } else {
        toast.error("Mint failed! Please try again!");
        fetchCandyMachine(userWalletPubKey);
      }
    } catch (error) {
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (!error.message) {
          message = "Transaction timeout! Please try again.";
        } else if (error.message.indexOf("0x137")) {
          console.log(error);
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          console.log(error);
          message = `SOLD OUT!`;
          window.location.reload();
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      toast.error(message);

      fetchCandyMachine(userWalletPubKey);
    } finally {
      setIsMinting(false);
    }
  };

  return {
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining,
    candyMachine: candyMachineState,
    isMinting,
    isValidBalance,
    isActive,
    mintToken,
  };
}

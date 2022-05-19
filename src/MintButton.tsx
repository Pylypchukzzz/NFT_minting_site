import styled from "styled-components";
import Button from "@material-ui/core/Button";
import { CandyMachine } from "./candy-machine";
import { CircularProgress } from "@material-ui/core";
import { GatewayStatus, useGateway } from "@civic/solana-gateway-react";
import { useEffect, useState, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  findGatewayToken,
  getGatewayTokenAddressForOwnerAndGatekeeperNetwork,
  onGatewayTokenChange,
  removeAccountChangeListener,
} from "@identity.com/solana-gateway-ts";

export const CTAButton = styled(Button)`
  width: 100%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  background: linear-gradient(#7fff2f 0%, #2fb62f 100%);
  color: white;
  font-size: 16px;
  font-weight: bold;
  opacity: 1;
  -moz-transition: all 0.2s ease-in-out;
  -webkit-transition: all 0.2s ease-in-out;
  -ms-transition: all 0.2s ease-in-out;
  -o-transition: all 0.2s ease-in-out;
  transition: all 0.2s ease-in-out;
  :hover {
    opacity: 0.8;
  }
`; // add your own styles here

export const MintButton = ({
  onMint,
  candyMachine,
  isMinting,
  rpcUrl,
  setIsMinting,
  isActive,
}: {
  onMint: () => Promise<void>;
  candyMachine?: CandyMachine;
  isMinting: boolean;
  setIsMinting: (val: boolean) => void;
  isActive: boolean;
  rpcUrl: string;
}) => {
  const wallet = useWallet();
  const connection = useConnection();
  const [verified, setVerified] = useState(false);
  const { requestGatewayToken, gatewayStatus } = useGateway();
  const [webSocketSubscriptionId, setWebSocketSubscriptionId] = useState(-1);
  const [clicked, setClicked] = useState(false);

  const getMintButtonContent = () => {
    if (candyMachine?.state.isSoldOut) {
      return "SOLD OUT";
    } else if (isMinting) {
      return <CircularProgress />;
    }

    return "MINT";
  };

  useEffect(() => {
    const mint = async () => {
      await removeAccountChangeListener(
        connection.connection,
        webSocketSubscriptionId
      );
      await onMint();

      setClicked(false);
      setVerified(false);
    };
    if (verified && clicked) {
      mint();
    }
  }, [
    verified,
    clicked,
    connection.connection,
    onMint,
    webSocketSubscriptionId,
  ]);

  const previousGatewayStatus = usePrevious(gatewayStatus);
  useEffect(() => {
    const fromStates = [
      GatewayStatus.NOT_REQUESTED,
      GatewayStatus.REFRESH_TOKEN_REQUIRED,
    ];
    const invalidToStates = [...fromStates, GatewayStatus.UNKNOWN];
    if (
      fromStates.find((state) => previousGatewayStatus === state) &&
      !invalidToStates.find((state) => gatewayStatus === state)
    ) {
      setIsMinting(true);
    }
    console.log("change: ", gatewayStatus);
  }, [setIsMinting, previousGatewayStatus, gatewayStatus]);

  return (
    <CTAButton
      disabled={isMinting || !isActive}
      onClick={async () => {
        if (candyMachine?.state.isActive && candyMachine?.state.gatekeeper) {
          const network =
            candyMachine.state.gatekeeper.gatekeeperNetwork.toBase58();
          if (network === "ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6") {
            if (gatewayStatus === GatewayStatus.ACTIVE) {
              await onMint();
            } else {
              // setIsMinting(true);
              await requestGatewayToken();
              console.log("after: ", gatewayStatus);
            }
          } else if (
            network === "ttib7tuX8PTWPqFsmUFQTj78MbRhUmqxidJRDv4hRRE" ||
            network === "tibePmPaoTgrs929rWpu755EXaxC7M3SthVCf6GzjZt"
          ) {
            setClicked(true);
            const gatewayToken = await findGatewayToken(
              connection.connection,
              wallet.publicKey!,
              candyMachine.state.gatekeeper.gatekeeperNetwork
            );

            if (gatewayToken?.isValid()) {
              await onMint();
            } else {
              let endpoint = rpcUrl;
              if (endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
              if (!endpoint.startsWith("https"))
                endpoint = "https" + endpoint.slice(4);

              window.open(
                `https://verify.encore.fans/?endpoint=${endpoint}&gkNetwork=${network}`,
                "_blank"
              );

              const gatewayTokenAddress =
                await getGatewayTokenAddressForOwnerAndGatekeeperNetwork(
                  wallet.publicKey!,
                  candyMachine.state.gatekeeper.gatekeeperNetwork
                );

              setWebSocketSubscriptionId(
                onGatewayTokenChange(
                  connection.connection,
                  gatewayTokenAddress,
                  () => setVerified(true),
                  "confirmed"
                )
              );
            }
          } else {
            setClicked(false);
            throw new Error(`Unknown Gatekeeper Network: ${network}`);
          }
        } else {
          await onMint();
          setClicked(false);
        }
      }}
      variant="contained"
    >
      {getMintButtonContent()}
    </CTAButton>
  );
};

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

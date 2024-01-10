import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";

const URL = "http://localhost:3000";

export const Room = ({
  name,
  localAudioTrack,
  localVideoTrack,
}: {
  name: string;
  localAudioTrack: MediaStreamTrack | null;
  localVideoTrack: MediaStreamTrack | null;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lobby, setLobby] = useState(true);
  const [socket, setSocket] = useState<null | Socket>(null);
  const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
  const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(
    null
  );
  const [remoteVideoTrack, setRemoteVideoTrack] =
    useState<MediaStreamTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] =
    useState<MediaStreamTrack | null>(null);
  const [remoteMediaStream, setRemoteMediaStream] =
    useState<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>();
  const localVideoRef = useRef<HTMLVideoElement>();

  useEffect(() => {
    const socket = io(URL);

    socket.on("send-offer", async ({ roomId }) => {
      console.log("sending offer");
      setLobby(false);
      const pc = new RTCPeerConnection();
      console.log(pc);
      setSendingPc(pc);
      if (localVideoTrack) {
        console.error("added tack");
        console.log(localVideoTrack);
        pc.addTrack(localVideoTrack);
      }
      if (localAudioTrack) {
        console.error("added tack");
        console.log(localAudioTrack);
        pc.addTrack(localAudioTrack);
      }

      pc.onicecandidate = async (e) => {
        console.log("receiving ice candidate locally");
        if (e.candidate) {
          socket.emit("add-ice-candidate", {
            candidate: e.candidate,
            type: "sender",
            roomId,
          });
        }
      };

      pc.onnegotiationneeded = async () => {
        console.log("on negotiation neeeded, sending offer");
        const sdp = await pc.createOffer();
        //@ts-ignore
        pc.setLocalDescription(sdp);
        socket.emit("offer", {
          sdp,
          roomId,
        });
      };
    });

    socket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
      console.log("received offer");
      setLobby(false);
      const pc = new RTCPeerConnection();
      pc.setRemoteDescription(remoteSdp);
      //@ts-ignore
      const stream = new MediaStream();
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setRemoteMediaStream(stream);
      // trickle ice
      setReceivingPc(pc);

      pc.onicecandidate = async (e) => {
        if (!e.candidate) {
          return;
        }
        console.log("omn ice candidate on receiving seide");
        if (e.candidate) {
          socket.emit("add-ice-candidate", {
            candidate: e.candidate,
            type: "receiver",
            roomId,
          });
        }
      };

      pc.ontrack = (e) => {
        console.error("inside ontrack");
        const { track, type } = e;
        if (type == "audio") {
          // setRemoteAudioTrack(track);
          // @ts-ignore
          remoteVideoRef.current.srcObject.addTrack(track);
        } else {
          // setRemoteVideoTrack(track);
          // @ts-ignore
          remoteVideoRef.current.srcObject.addTrack(track);
        }
        //@ts-ignore
        remoteVideoRef.current.play();
      };

      const sdp = await pc.createAnswer();
      pc.setLocalDescription(sdp);

      socket.emit("answer", {
        roomId,
        sdp: sdp,
      });

      //   setTimeout(() => {
      //     const track1 = pc.getTransceivers()[0].receiver.track;
      //     const track2 = pc.getTransceivers()[1].receiver.track;
      //     console.log(track1);
      //     if (track1.kind === "video") {
      //       setRemoteAudioTrack(track2);
      //       setRemoteVideoTrack(track1);
      //     } else {
      //       setRemoteAudioTrack(track1);
      //       setRemoteVideoTrack(track2);
      //     }
      //     //@ts-ignore
      //     remoteVideoRef.current.srcObject.addTrack(track1);
      //     //@ts-ignore
      //     remoteVideoRef.current.srcObject.addTrack(track2);
      //     //@ts-ignore
      //     remoteVideoRef.current.play();
      //     // if (type == 'audio') {
      //     //     // setRemoteAudioTrack(track);
      //     //     // @ts-ignore
      //     //     remoteVideoRef.current.srcObject.addTrack(track)
      //     // } else {
      //     //     // setRemoteVideoTrack(track);
      //     //     // @ts-ignore
      //     //     remoteVideoRef.current.srcObject.addTrack(track)
      //     // }
      //     // //@ts-ignore
      //   }, 5000);
    });

    socket.on("answer", ({ roomId, sdp: remoteSdp }) => {
      setLobby(false);
      setSendingPc((pc) => {
        pc?.setRemoteDescription(remoteSdp);
        return pc;
      });
      console.log("loop closed");
    });

    socket.on("lobby", () => {
      setLobby(true);
    });

    socket.on("add-ice-candidate", ({ candidate, type }) => {
      console.log("add ice candidate from remote");
      console.log({ candidate, type });
      if (type == "sender") {
        setReceivingPc((pc) => {
          pc?.addIceCandidate(candidate);
          return pc;
        });
      } else {
        setSendingPc((pc) => {
          pc?.addIceCandidate(candidate);
          return pc;
        });
      }
    });

    setSocket(socket);
  }, [name]);

  useEffect(() => {
    if (localVideoRef.current) {
      if (localVideoTrack) {
        localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
        localVideoRef.current.play();
      }
    }
  }, [localVideoRef]);

  return (
    <div>
      Hi {name}
      <video autoPlay width={400} height={400} ref={localVideoRef} />
      {lobby ? "Waiting to connect you to someone" : null}
      <video autoPlay width={400} height={400} ref={remoteVideoRef} />
    </div>
  );
};

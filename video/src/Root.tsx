import { Composition } from "remotion";
import { OrnetShowcase, TOTAL_FRAMES } from "./Composition";
import { OrnetUpworkShowcase, TOTAL_FRAMES as UPWORK_FRAMES } from "./upwork/OrnetUpworkShowcase";
import "./index.css";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="OrnetShowcase"
        component={OrnetShowcase}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="OrnetUpwork"
        component={OrnetUpworkShowcase}
        durationInFrames={UPWORK_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

// @flow

import React from "react";

const Pen = ({ size = 16, color = "currentColor" }: { size: number, color?: string }) => (
  <svg viewBox="0 0 18 20" height={size} width={size}>
    <g fill={color}>
      <path
        d="M16.36,3,14.47,1.06A2.07,2.07,0,0,0,13.21.5H2.86A1.78,1.78,0,0,0,1.08,2.28V17.72A1.76,1.76,0,0,0,2.86,19.5H15.14a1.78,1.78,0,0,0,1.78-1.78V4.21A2,2,0,0,0,16.36,3ZM15.14,17.5a.22.22,0,0,1-.23.22H3.09a.2.2,0,0,1-.23-.22V2.5a.22.22,0,0,1,.23-.22H11V5.55a.86.86,0,0,0,.89.89h3.27Zm0-12.84H12.76V2.28h.33a.17.17,0,0,1,.15.08l1.82,1.81a.2.2,0,0,1,.08.15Z"
      />
      <path
        d="M8.46,8.61l-2,2a.54.54,0,0,1-.76-.76L8.62,6.93a.54.54,0,0,1,.76,0L12.25,9.8a.54.54,0,0,1-.76.76l-2-2v6.1a.54.54,0,0,1-1.08,0Z"
      />
    </g>
  </svg>
);

export default Pen;

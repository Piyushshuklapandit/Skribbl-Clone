import { useEffect, useRef, useState } from "react";

function DrawingCanvas({ socket, roomId, isDrawer }) {
  const canvasRef = useRef(null);
  const replayCanvasRef = useRef(null);

  const isDrawing = useRef(false);
  const lastPosition = useRef(null);

  // Smooth drawing ke liye
  const pendingPoint = useRef(null);
  const animationFrame = useRef(null);

  // Undo
  const history = useRef([]);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(5);
  const [eraser, setEraser] = useState(false);
  const [replay, setReplay] = useState(null);
  const palette = ["#000000", "#ffffff", "#ff0000", "#ff7f00", "#ffd400", "#0ca70c", "#1ec7b6", "#1e5ce0", "#2b217b", "#8511c2", "#f08ad3", "#c86f50", "#7e401e"];

  // ===============================
  // DRAW LINE
  // ===============================

  const drawLine = (
    x0,
    y0,
    x1,
    y1,
    lineColor,
    lineSize
  ) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.beginPath();

    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineSize;

    // Smooth brush
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();

    ctx.closePath();
  };

  // ===============================
  // SAVE CANVAS STATE
  // ===============================

  const saveCanvasState = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    history.current.push(
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      )
    );

    if (history.current.length > 20) {
      history.current.shift();
    }
  };

  // ===============================
  // RECEIVE DRAWING
  // ===============================

  useEffect(() => {
    const handleDrawData = (data) => {
      drawLine(
        data.x0,
        data.y0,
        data.x1,
        data.y1,
        data.color,
        data.size
      );
    };

    const handleClearCanvas = () => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      history.current = [];
    };

    const handleUndo = () => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      const previousState =
        history.current.pop();

      if (previousState) {
        ctx.putImageData(
          previousState,
          0,
          0
        );
      }
    };

    const drawStrokes = (canvas, strokes) => {
      if (!canvas || !Array.isArray(strokes)) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const stroke of strokes) {
        for (const segment of Array.isArray(stroke) ? stroke : [stroke]) {
          if (!segment) continue;
          ctx.beginPath();
          ctx.moveTo(segment.x0, segment.y0);
          ctx.lineTo(segment.x1, segment.y1);
          ctx.strokeStyle = segment.color || "#000";
          ctx.lineWidth = segment.size || 5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();
        }
      }
    };

    const handleDrawReplay = (strokes) => drawStrokes(canvasRef.current, strokes);
    const handleRoundReplay = (strokes) => setReplay(Array.isArray(strokes) ? strokes : []);

    socket.on("draw_data", handleDrawData);
    socket.on("canvas_clear", handleClearCanvas);
    socket.on("draw_undo", handleUndo);
    socket.on("draw_replay", handleDrawReplay);
    socket.on("round_replay_data", handleRoundReplay);

    return () => {
      socket.off("draw_data", handleDrawData);
      socket.off("canvas_clear", handleClearCanvas);
      socket.off("draw_undo", handleUndo);
      socket.off("draw_replay", handleDrawReplay);
      socket.off("round_replay_data", handleRoundReplay);
    };
  }, [socket]);

  useEffect(() => {
    if (replay) {
      const canvas = replayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const stroke of replay) {
        for (const segment of Array.isArray(stroke) ? stroke : [stroke]) {
          if (!segment) continue;
          ctx.beginPath();
          ctx.moveTo(segment.x0, segment.y0);
          ctx.lineTo(segment.x1, segment.y1);
          ctx.strokeStyle = segment.color || "#000";
          ctx.lineWidth = segment.size || 5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();
        }
      }
    }
  }, [replay]);

  // ===============================
  // GET MOUSE POSITION
  // ===============================

  const getPosition = (event) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect =
      canvas.getBoundingClientRect();

    // Canvas actual size aur displayed size
    // different ho sakta hai
    const scaleX =
      canvas.width / rect.width;

    const scaleY =
      canvas.height / rect.height;

    return {
      x:
        (event.clientX - rect.left) *
        scaleX,

      y:
        (event.clientY - rect.top) *
        scaleY,
    };
  };

  // ===============================
  // MOUSE DOWN
  // ===============================

  const startDrawing = (event) => {
    if (!isDrawer) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);

    saveCanvasState();

    const { x, y } =
      getPosition(event);

    isDrawing.current = true;

    lastPosition.current = {
      x,
      y,
    };

    const drawingColor = eraser
      ? "#ffffff"
      : color;

    const drawingSize = eraser
      ? size * 2
      : size;

    // Starting point
    drawLine(
      x,
      y,
      x,
      y,
      drawingColor,
      drawingSize
    );

    socket.emit("draw_start", {
      roomId,
      x,
      y,
      color: drawingColor,
      size: drawingSize,
    });
  };

  // ===============================
  // SEND DRAWING POINT
  // ===============================

  const sendDrawingPoint = () => {
    if (!pendingPoint.current) {
      animationFrame.current = null;
      return;
    }

    const point = pendingPoint.current;

    pendingPoint.current = null;

    if (!lastPosition.current) {
      animationFrame.current = null;
      return;
    }

    const {
      x: x0,
      y: y0,
    } = lastPosition.current;

    const {
      x: x1,
      y: y1,
    } = point;

    const drawingColor = eraser
      ? "#ffffff"
      : color;

    const drawingSize = eraser
      ? size * 2
      : size;

    // Local drawing
    drawLine(
      x0,
      y0,
      x1,
      y1,
      drawingColor,
      drawingSize
    );

    // Send to server
    socket.emit("draw_move", {
      roomId,
      x0,
      y0,
      x1,
      y1,
      color: drawingColor,
      size: drawingSize,
    });

    lastPosition.current = {
      x: x1,
      y: y1,
    };

    animationFrame.current = null;
  };

  // ===============================
  // MOUSE MOVE
  // ===============================

  const drawing = (event) => {
    if (!isDrawer) return;

    if (!isDrawing.current) return;

    const { x, y } =
      getPosition(event);

    pendingPoint.current = {
      x,
      y,
    };

    // Browser ke animation frame ke according
    // drawing update hoga
    if (!animationFrame.current) {
      animationFrame.current =
        requestAnimationFrame(
          sendDrawingPoint
        );
    }
  };

  // ===============================
  // MOUSE UP
  // ===============================

  const stopDrawing = () => {
    if (!isDrawer) return;

    if (!isDrawing.current) return;

    // Pending point ko process karo
    if (pendingPoint.current) {
      sendDrawingPoint();
    }

    isDrawing.current = false;

    lastPosition.current = null;
    pendingPoint.current = null;

    if (animationFrame.current) {
      cancelAnimationFrame(
        animationFrame.current
      );

      animationFrame.current = null;
    }

    socket.emit("draw_end", {
      roomId,
    });
  };

  // ===============================
  // CLEAR CANVAS
  // ===============================

  const clearCanvas = () => {
    if (!isDrawer) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    history.current = [];

    socket.emit("canvas_clear", {
      roomId,
    });
  };

  // ===============================
  // UNDO
  // ===============================

  const undo = () => {
    if (!isDrawer) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const previousState =
      history.current.pop();

    if (!previousState) return;

    ctx.putImageData(
      previousState,
      0,
      0
    );

    socket.emit("draw_undo", {
      roomId,
    });
  };

  return (
    <div className="canvas-wrap canvas-wrap-classic">
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        width={900}
        height={520}
        onPointerDown={startDrawing}
        onPointerMove={drawing}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {replay && <div className="replay-overlay"><div className="replay-card"><div className="replay-heading"><strong>Last round replay</strong><button type="button" onClick={() => setReplay(null)} aria-label="Close replay">Close</button></div><canvas ref={replayCanvasRef} width={900} height={520} /></div></div>}
      {isDrawer && (
        <div className="toolbar-classic">
          <div className="classic-colors" aria-label="Color palette">
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={"classic-color-swatch " + (color === swatch && !eraser ? "active" : "")}
                style={{ background: swatch }}
                aria-label={"Choose " + swatch}
                title={swatch}
                onClick={() => { setColor(swatch); setEraser(false); }}
              />
            ))}
          </div>
          <div className="classic-sizes" aria-label="Brush size">
            {[4, 8, 14].map((brushSize) => (
              <button
                key={brushSize}
                type="button"
                className={"size-dot-btn " + (size === brushSize ? "active" : "")}
                aria-label={"Brush size " + brushSize}
                onClick={() => setSize(brushSize)}
              >
                <span style={{ width: brushSize, height: brushSize }} />
              </button>
            ))}
          </div>
          <div className="classic-tools">
            <button type="button" className={"classic-tool-btn " + (!eraser ? "active" : "")} aria-label="Brush" onClick={() => setEraser(false)}>B</button>
            <button type="button" className={"classic-tool-btn " + (eraser ? "active" : "")} aria-label="Eraser" onClick={() => setEraser(true)}>E</button>
            <button type="button" className="classic-tool-btn" aria-label="Undo" onClick={undo}>U</button>
            <button type="button" className="classic-tool-btn" aria-label="Clear canvas" onClick={clearCanvas}>C</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DrawingCanvas;

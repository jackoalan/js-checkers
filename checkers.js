/*
 * Checkers Game
 * Jack Andersen
 * CS200
 */

/* Dimension of board, must be even and >= 2 */
if (typeof BOARD_DIM === "undefined")
  BOARD_DIM = 8;

/* Enable turn enforcement */
if (typeof TURN_BASED === "undefined")
  TURN_BASED = true;

/* Set to prevent piece being dragged outside board */
if (typeof CONSTRAIN_PIECE === "undefined")
  CONSTRAIN_PIECE = false;

/*
 * Helper for bulk-registering DOM events on behalf of its delegate object.
 * eventDict must be a dictionary of [function, bool] where the bool
 * enables immediate registration of the event, otherwise leaves it
 * to the delegate to register later.
 */
function RegisterEventDict(obj, element, eventDict) {
  obj.handleEvent = function(event) { eventDict[event.type][0].call(this, event); };
  for (const ev in eventDict)
    if (eventDict[ev][1])
      element.addEventListener(ev, obj);
}

/* Delegate for tile element */
class Tile {
  constructor(parent, x, y) {
    this.parent = parent;
    this.x = x;
    this.y = y;
    this.piece = null;
    this.element = document.createElement("div");
    this.element.classList.add(((x + y) & 1) ? "boardTileOdd" : "boardTileEven");
    this.element.style.position = "absolute";
    parent.boardElement.appendChild(this.element);
    RegisterEventDict(this, this.element, {
      "droppiece": [this.ondroppiece, true]
    });
  }

  positionTile(tilePxDim) {
    this.element.style.width = tilePxDim + "px";
    this.element.style.height = tilePxDim + "px";
    this.element.style.left = tilePxDim * this.x + "px";
    this.element.style.top = tilePxDim * this.y + "px";
  }

  remove() {
    this.element.remove();
  }

  /*
   * The tile's droppiece handler associates the piece with the coordinates
   * of the tile so the checkerboard can make a high level decision with
   * the necessary parameters.
   */
  ondroppiece(event) {
    if (this.parent.dropPiece(event.detail, this))
      event.preventDefault();
  }
}

/* Delegate for piece element */
class Piece {
  constructor(parent, red, tile) {
    this.parent = parent;
    this.red = red;
    this.king = false;
    this.tile = tile;
    tile.piece = this;
    this.tilePxDim = 0;
    this.piecePxDim = 0;
    this.dropping = false;
    this.beingCaptured = false;
    this.element = document.createElement("div");
    this.element.classList.add(red ? "pieceRed" : "pieceBlack");
    this.element.style.position = "absolute";
    this.element.style.boxSizing = "border-box";
    this.element.style.transition = "transform 0.5s";
    this.element.style.zIndex = "1";
    this.element.style.userSelect = "none";
    parent.boardElement.appendChild(this.element);
    this.shadow = document.createElement("div");
    this.shadow.classList.add("pieceShadow");
    this.shadow.style.position = "absolute";
    this.shadow.style.transition = "";
    this.shadow.style.zIndex = "0";
    parent.boardElement.appendChild(this.shadow);

    function oncontextmenu(event) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    /*
     * Pointer events are used instead of mouse events since they are more
     * drag-n-drop friendly (i.e. they can be captured to work outside
     * the window or if the pointer unexpectedly exits the element).
     */
    RegisterEventDict(this, this.element, {
      "pointerdown": [this.onpointerdown, true],
      "pointerup": [this.onpointerup, true],
      "pointercancel": [this.onpointercancel, true],
      "pointermove": [this.onpointermove, false],
      "transitionend": [this.ontransitionend, true],
      "contextmenu": [oncontextmenu, true]
    });
  }

  _setPieceCoordinates(x, y) {
    this.element.style.left = x + "px";
    this.element.style.top = y + "px";
    this.shadow.style.left = x + "px";
    this.shadow.style.top = y + "px";
  }

  _positionPiece() {
    this._setPieceCoordinates(this.tilePxDim * this.tile.x, this.tilePxDim * this.tile.y);
  }

  positionPiece(tilePxDim) {
    this.tilePxDim = tilePxDim;
    const marginFactor = 0.7;
    const piecePxDim = tilePxDim * marginFactor;
    this.piecePxDim = piecePxDim;
    const piecePxMargin = tilePxDim * (1 - marginFactor) / 2;
    this.element.style.width = piecePxDim + "px";
    this.element.style.height = piecePxDim + "px";
    this.element.style.margin = piecePxMargin + "px";
    this.element.style.borderRadius = piecePxDim + "px";
    this.element.style.textAlign = "center";
    this.element.style.padding = piecePxMargin / 2 + "px 0";
    this.element.style.fontSize = piecePxMargin * 2 + "px";
    this.shadow.style.width = piecePxDim + "px";
    this.shadow.style.height = piecePxDim + "px";
    this.shadow.style.margin = piecePxMargin + "px";
    this.shadow.style.borderRadius = piecePxDim + "px";
    this._positionPiece();
  }

  makeKing() {
    this.king = true;
    this.element.classList.replace(this.red ? "pieceRed" : "pieceBlack",
                                   this.red ? "pieceRedKing" : "pieceBlackKing");
    this.element.innerHTML = "👑";
  }

  setTile(tile) {
    if (tile.piece)
      return false;
    this.tile.piece = null;
    this.tile = tile;
    this.tile.piece = this;
    if (this.tile.y == 0 || this.tile.y == this.parent.tileDim - 1)
      this.makeKing();
    this._positionPiece();
    return true;
  }

  capture() {
    this.tile.piece = null;
    this.parent.pieces.splice(this.parent.pieces.indexOf(this), 1);
    this.beingCaptured = true;
    this.element.style.transition = "transform 1s, opacity 1s";
    this.element.style.transform = "translateZ(40px)";
    this.element.style.opacity = "0";
    this.shadow.style.transition = "opacity 1s";
    this.shadow.style.opacity = "0";
  }

  remove() {
    this.element.remove();
    this.shadow.remove();
  }

  setTransitionEase() {
    this.element.style.transition = "transform 0.5s, left 0.5s, top 0.5s";
    this.shadow.style.transition = "left 0.5s, top 0.5s";
  }

  resetTransitionEase() {
    this.element.style.transition = "transform 0.5s";
    this.shadow.style.transition = "";
  }

  onpointerdown(event) {
    if (TURN_BASED && this.parent.redTurn != this.red)
      return;

    this.element.addEventListener("pointermove", this);
    this.element.setPointerCapture(event.pointerId);

    this.element.style.transform = "translateZ(20px)";
    this.element.style.zIndex = "3";
    this.shadow.style.zIndex = "2";
    this.setTransitionEase();

    this._onpointermove(event);
  }

  onpointerup(event) {
    this.element.removeEventListener("pointermove", this);
    this.element.releasePointerCapture(event.pointerId);

    this.element.style.transform = "translateZ(0)";
    this.dropping = true;
    this.setTransitionEase();

    /*
     * Use a custom DOM event to handle piece dropping. Cancelling the event with
     * event.preventDefault() will bypass the position restoration.
     */
    for (const element of document.elementsFromPoint(event.clientX, event.clientY))
      if (!element.dispatchEvent(new CustomEvent("droppiece", {detail: this, cancelable: true})))
        return;

    this._positionPiece();
  }

  onpointercancel(event) {
    this.element.removeEventListener("pointermove", this);
    this.element.releasePointerCapture(event.pointerId);

    this.element.style.transform = "translateZ(0)";
    this.dropping = true;
    this.setTransitionEase();

    this._positionPiece();
  }

  _onpointermove(event) {
    const coord = checkers.screenCoordinateToBoardCoordinate(event.clientX, event.clientY);
    const adjust = this.tilePxDim / 2;
    this._setPieceCoordinates(coord.x - adjust, coord.y - adjust);
  }

  onpointermove(event) {
    this.resetTransitionEase();
    this._onpointermove(event);
  }

  ontransitionend(event) {
    if (this.dropping) {
      this.element.style.zIndex = "1";
      this.shadow.style.zIndex = "0";
      this.dropping = false;
    }
    if (this.beingCaptured) {
      this.remove();
      return;
    }
    this.resetTransitionEase();
  }
}

/* Main checkerboard controller */
class Checkers {
  constructor(tileDim) {
    if (tileDim < 2)
      console.warn("Board dimension must be >= 2");
    if (tileDim & 1)
      console.warn("Board dimension must be even");
    this.tileDim = Math.max(2, tileDim) & ~1;
    this.boardPxDim = 0;
    this.tilePxDim = 0;
    this.boardX = 0;
    this.boardY = 0;
    this.tiles = [];
    this.pieces = [];
    this.vertices = null;
    this.edges = null;
    this.invAreas = null;
    this.boardElement = null;
    this.lastTriangle = 0;
    this.boxShadowStr = null;
    this.redTurn = TURN_BASED;
  }

  getTile(x, y) {
    return this.tiles[y * this.tileDim + x];
  }

  removeObjects() {
    while (this.tiles.length)
      this.tiles.pop().remove();
    while (this.pieces.length)
      this.pieces.pop().remove();
    this.boardElement.remove();
  }

  createObjects() {
    this.boardElement = document.createElement("div");
    this.boardElement.classList.add("board");
    this.boardElement.style.position = "absolute";
    this.boardElement.style.transition = "box-shadow 0.5s";
    document.body.appendChild(this.boardElement);
    this.boxShadowStr = window.getComputedStyle(this.boardElement).boxShadow;
    this.setTurn(this.redTurn);

    for (let y = 0; y < this.tileDim; ++y)
      for (let x = 0; x < this.tileDim; ++x)
        this.tiles.push(new Tile(this, x, y));

    const pieceRows = Math.min(3, this.tileDim / 2);
    for (let red = 0; red < 2; ++red) {
      const yStart = red ? this.tileDim - pieceRows : 0;
      const yEnd = yStart + pieceRows;
      for (let y = yStart; y < yEnd; ++y)
        for (let x = 0; x < this.tileDim; x += 2)
          this.pieces.push(new Piece(this, red, this.getTile(x + !(y & 1), y)));
    }
  }

  setBoardShadowColor(r, g, b) {
    const re = /rgba\(([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*/;
    this.boardElement.style.boxShadow = this.boxShadowStr.replace(re, "rgba(" + r + "," + g + "," + b + ",");
  }

  positionObjects() {
    /* Scalable layout logic */
    const windowW = document.documentElement.clientWidth;
    const windowH = document.documentElement.clientHeight;
    var marginX = windowW * 0.1;
    if (windowW < marginX * 2)
      marginX = windowW / 2;
    var marginY = windowH * 0.1;
    if (windowH < marginY * 2)
      marginY = windowH / 2;
    if (windowW < windowH) {
      var boardPxDim = windowW - marginX * 2;
      var boardX = marginX;
      var boardY = (windowH - boardPxDim) / 2;
    } else {
      var boardPxDim = windowH - marginY * 2;
      var boardX = (windowW - boardPxDim) / 2;
      var boardY = marginY;
    }
    this.boardPxDim = boardPxDim;
    this.boardX = boardX;
    this.boardY = boardY;

    this.boardElement.style.width = boardPxDim + "px";
    this.boardElement.style.height = boardPxDim + "px";
    this.boardElement.style.left = boardX + "px";
    this.boardElement.style.top = boardY + "px";
    this.boardElement.style.transformStyle = "preserve-3d";
    this.boardElement.style.transform = "perspective(1000px) rotateX(30deg)";

    /* Propagate board scale to pieces */
    const tilePxDim = boardPxDim / this.tileDim;
    this.tilePxDim = tilePxDim;
    for (const tile of this.tiles)
      tile.positionTile(tilePxDim);
    for (const piece of this.pieces)
      piece.positionPiece(tilePxDim);

    /*
     * Everything after this point precomputes information for efficient
     * execution of screenCoordinateToBoardCoordinate.
     */

    /* Perspective matrix from CSS */
    const matrix = new DOMMatrix(window.getComputedStyle(this.boardElement).transform);

    /* Calculates screen-space coordinates from board-space unit coordinates. */
    const projectBoardCoordinate = (x, y) => {
      /* Make coordinates center-origin for correct perspective transformation. */
      const midBoard = boardPxDim / 2;
      const point = new DOMPoint(x * boardPxDim - midBoard,
                                 y * boardPxDim - midBoard).matrixTransform(matrix);
      /* 
       * The computed CSS matrix transforms coordinates into clip-space,
       * so we divide by W to achieve screen-space coordinates.
       * W is also stored pre-inverted for use by the barycentric
       * interpolation procedure.
       */
      return new DOMPoint(point.x / point.w + midBoard + boardX,
                          point.y / point.w + midBoard + boardY,
                          0, 1 / point.w);
    }

    /*
     * Associates the screen-space projected coordinate and W inverse
     * with board-space unit coordinates.
     */
    class Vertex {
      constructor(P, U, V) {
        this.P = P;
        this.U = U * boardPxDim;
        this.V = V * boardPxDim;
      }
    }

    /*
     * References fixed edge points and provides determinant function for conveniently
     * calculating barycentric coordinates of an arbitrary screen-space point.
     */
    class Edge {
      constructor(P1, P2) {
        this.P1 = P1;
        this.P2 = P2;
      }
      edgeFunction(scrX, scrY) {
        return (this.P2.x - this.P1.x) * (scrY - this.P1.y) - (this.P2.y - this.P1.y) * (scrX - this.P1.x);
      };
    }

    /*
     * Board quad is tessellated into two back-to-back triangles
     * for barycentric interpolation.
     * 
     *    A-1-B
     *    /  /\
     *   2 0/3 5
     *  / /     \
     * C----4----D
     */
    const A = projectBoardCoordinate(0, 0);
    const B = projectBoardCoordinate(1, 0);
    const C = projectBoardCoordinate(0, 1);
    const D = projectBoardCoordinate(1, 1);
    this.vertices = [
      new Vertex(A, 0, 0),
      new Vertex(C, 0, 1),
      new Vertex(B, 1, 0),
      new Vertex(D, 1, 1),
      new Vertex(B, 1, 0),
      new Vertex(C, 0, 1)
    ];
    this.edges = [
      new Edge(C, B),
      new Edge(B, A),
      new Edge(A, C),
      new Edge(B, C),
      new Edge(C, D),
      new Edge(D, B)
    ];

    /* Multiply to easily normalize barycentric coordinates of either triangle. */
    this.invAreas = [1 / this.edges[0].edgeFunction(A.x, A.y),
                     1 / this.edges[3].edgeFunction(D.x, D.y)];
  }

  screenCoordinateToBoardCoordinate(x, y) {
    const processTriangle = (tri) => {
      /*
       * Perform perspective-correct barycentric interpolation
       * like a 3D triangle rasterizer would do.
       * 
       * References:
       * https://fgiesen.wordpress.com/2013/02/06/the-barycentric-conspirac/
       * https://github.com/magcius/sw3dv/blob/gh-pages/sw_rast.js#L108
       */
      var u = 0;
      var v = 0;
      var w = 0;
      for (let i = 0; i < 3; ++i) {
        const edge = this.edges[tri * 3 + i];
        const vertex = this.vertices[tri * 3 + i];
        const bary = edge.edgeFunction(x, y) * this.invAreas[tri] * vertex.P.w;
        if (bary < 0) {
          /* If hypotenuse is crossed, process other triangle. */
          if (i == 0)
            return null;
          /* Optionally constrain piece to board. */
          if (CONSTRAIN_PIECE)
            continue;
        }
        u += vertex.U * bary;
        v += vertex.V * bary;
        w += bary;
      }
      w = 1 / w;

      /* Board-space coordinates are analogous to texture coordinates. */
      return new DOMPoint(u * w, v * w);
    }

    /* 
     * Process both triangles of the board quad, starting with previous
     * triangle result as a predictive branching measure.
     */
    for (let i = 0, t = this.lastTriangle; i < 2; ++i, t = t ^ 1) {
      const point = processTriangle(t);
      if (point) {
        this.lastTriangle = t;
        return point;
      }
    }

    /* Should not be reached */
    console.error("Barycentric failure");
    return null;
  }

  setTurn(red) {
    this.redTurn = red;
    this.setBoardShadowColor(red ? 200 : 0, 0, 0);
  }

  dropPiece(piece, tile) {
    /*
     * Rules of checkers are mostly implemented here.
     * Returning false will restore the piece to its previous position.
     */

    /* Movement rules for various pieces */
    const dy = tile.y - piece.tile.y;
    const dx = tile.x - piece.tile.x;
    const ady = Math.abs(dy);
    const adx = Math.abs(dx);

    /* Ensure diagonal movement */
    if (adx != ady)
      return false;

    /* Direction rules */
    if (piece.king) {
      /* May move +/-Y */
      if (dy == 0)
        return false;
    } else if (piece.red) {
      /* May move -Y */
      if (dy >= 0)
        return false;
    } else {
      /* May move +Y */
      if (dy <= 0)
        return false;
    }

    /* Distance rules */
    var capturePiece = null;
    if (ady == 2) {
      capturePiece = this.getTile(piece.tile.x + (dx >> 1), piece.tile.y + (dy >> 1)).piece;
      if (!capturePiece)
        return false;
      if (piece.red == capturePiece.red)
        return false;
    } else if (ady != 1) {
      return false;
    }

    /* Attempt to move piece to tile. Returns false if tile occupied. */
    if (!piece.setTile(tile))
      return false;

    /* Capture piece if there is one */
    if (capturePiece)
      capturePiece.capture();

    /* Next turn */
    if (TURN_BASED)
      this.setTurn(this.redTurn ^ 1);

    return true;
  }
}

/* Instantiate checkerboard and create/position elements. */
checkers = new Checkers(BOARD_DIM);
window.onload = function() {
  checkers.createObjects();
  checkers.positionObjects();
};

/* Reposition elements when the window is resized. */
window.onresize = function() {
  checkers.positionObjects();
}

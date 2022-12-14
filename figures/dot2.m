function dot2(word, textoffset)
  declare_globals
  if nargin < 2
    textoffset = [0.1, 0.5];
  end
  [x, y, label] = word{:};
  blue = [0.2, 0.2, 1.0];
  plot(x, y, 'o', 'MarkerSize', markersize2d, 'MarkerEdgeColor', blue, 'MarkerFaceColor', blue)
  text(x+textoffset(1), y+textoffset(2), label, 'FontSize', 15)
  

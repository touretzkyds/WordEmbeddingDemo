function dot2(word, textoffset, color)
  declare_globals
  blue = [0.2, 0.2, 1.0];
  if nargin < 2 || length(textoffset) != 2
    textoffset = [0.1, 0.5];
  end
  if nargin < 3
    color = blue;
  end
  [x, y, label] = word{:};
  plot(x, y, 'o', 'MarkerSize', markersize2d, 'MarkerEdgeColor', color, 'MarkerFaceColor', color)
  text(x+textoffset(1), y+textoffset(2), label, 'FontSize', 15)
  

fig2

for i = 1:length(words)
  x = words{i,1};
  y = words{i,2};
  theta = atan2(y,x);
  r = norm([x,y]) - marker2doffset;
  xo = r * cos(theta);
  yo = r * sin(theta);
  quiver(0, 0, xo, yo, 1, 'MaxHeadSize', 0.02)
end

title("Words As Vectors", 'FontSize', 20)

savefigure("fig5.png")

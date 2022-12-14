fig2

xc = nan;
yc = nan;

for i = 1 : length(words)
  if strcmp(words{i,3}, 'boy')
    xc = words{i,1};
    yc = words{i,2};
    break
  end
end

for i = 1 : length(words)
  x = words{i,1} - xc;
  y = words{i,2} - yc;
  theta = atan2(y,x);
  r = norm([x,y]) - marker2doffset;
  xo = r * cos(theta);
  yo = r * sin(theta);
  quiver(xc, yc, xo, yo, 1, 'MaxHeadSize', 0.04)
end

xlabel('Gender', 'Fontsize', 15)
ylabel('Age', 'Fontsize', 15)
title("Vectors From 'boy'", 'FontSize', 20)

savefigure("fig6.png")

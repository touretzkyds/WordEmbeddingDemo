clf
maxval = 5;
floormax = floor(maxval);
axis([-maxval, maxval, -maxval, maxval]) 
axis square
set(gca, 'xtick', -floormax : floormax)
set(gca, 'ytick', -floormax : floormax)
hold on
box on
grid on

line([0,0], [-maxval,maxval])
line([-maxval,maxval], [0,0])

words2

words = [w_man; w_woman; w_boy; w_girl; ...
         w_adult; w_child; w_infant; w_grandfather ];

xmean = mean([words{:,1}]);
ymean = mean([words{:,2}]);

centered_words = words;
centered_words(:,1) = num2cell([centered_words{:,1}] - xmean);
centered_words(:,2) = num2cell([centered_words{:,2}] - ymean);

for i = 1:length(centered_words)
  dot2({centered_words{i,:}})
  x = centered_words{i,1};
  y = centered_words{i,2};
  theta = atan2(y,x);
  r = norm([x,y]) - marker2doffset;
  xo = r * cos(theta);
  yo = r * sin(theta);
  quiver(0, 0, xo, yo, 1, 'MaxHeadSize', 0.02)
end

xlabel('Gender', 'Fontsize', 15)
ylabel('Age', 'Fontsize', 15)
title('Zero-Mean 2D Vectors', 'FontSize', 20)

savefigure("fig7.png")

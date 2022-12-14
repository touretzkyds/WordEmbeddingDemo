setup_params

clf
maxval = 1.25;
axis([-maxval, maxval, -maxval, maxval]) 
axis square
set(gca, 'xtick', -maxval : 0.25: maxval)
set(gca, 'ytick', -maxval : 0.25: maxval)
hold on
box on
grid on

line([0,0], [-maxval,maxval])
line([-maxval,maxval], [0,0])

words2

xmean = mean([words{:,1}]);
ymean = mean([words{:,2}]);

centered_words = words;
centered_words(:,1) = num2cell([centered_words{:,1}] - xmean);
centered_words(:,2) = num2cell([centered_words{:,2}] - ymean);

pts = 0 : 0.05 : 2*pi;
plot(cos(pts), sin(pts),':k')

textoffset = [0.04, 0.1];
for i = 1:length(centered_words)
  [x, y, word] = centered_words{i,:};
  theta = atan2(y,x);
  r = norm([x,y]);
  if strcmp(word,'infant') == 0
    this_textoffset = textoffset;
  else
    this_textoffset = -textoffset;
  end
  dot2({x/r, y/r, word}, this_textoffset)
  printf('%12s  %8.4f  %8.4f\n', word, x/r, y/r)
  ro = 1 - unit2doffset;
  xo = ro * cos(theta);
  yo = ro * sin(theta);
  quiver(0, 0, xo, yo, 1, 'MaxHeadSize', 0.02)
end

xlabel('Gender', 'Fontsize', 15)
ylabel('Age', 'Fontsize', 15)
title('Zero-Mean 2D Unit Vectors', 'FontSize', 20)

savefigure('fig8.png')

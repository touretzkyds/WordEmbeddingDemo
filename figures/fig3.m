setup_params

clf
axis([0 10 0 10 0 10])
axis square
set(gca, 'xtick', 0:10)
set(gca, 'ytick', 0:10)
set(gca, 'ztick', 0:10)
box on
grid on
hold on

%view(-25, 22)
view(-56.2, 12.1)

words3   % load word definitions

analogy_words = [w_man; w_woman; w_boy; w_girl; ...
                 w_king; w_queen; w_prince; w_princess];

for i = 1:length(analogy_words)
  word = analogy_words(i,:);
  [y,z,x] = word{1:3};
  plot3([x, x], [y, y], [0,z], ':', 'Color', [0.8, 0, 0], 'LineWidth', 2)
end

for i = 1:length(analogy_words)
  word = analogy_words(i,:);
  dot3(word,1)
end

ylabel('Gender', 'Fontsize', 15)
zlabel('Age', 'Fontsize', 15)
xlabel('Royalty', 'FontSize', 15)
title('3D Semantic Feature Space', 'FontSize', 20)

savefigure("fig3.png")

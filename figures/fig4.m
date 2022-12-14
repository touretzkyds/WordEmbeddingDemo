setup_params

clf
axis([0 10 0 10 0 10])
set(gca, 'xtick', 0:10)
set(gca, 'ytick', 0:10)
set(gca, 'ztick', 0:10)
box on
grid on
hold on

view(-7.8, 15.15)


words3   % load word definitions

analogy_words = [w_man; w_woman; w_boy; w_girl; ...
                 w_king; w_queen; w_prince; w_princess];

for i = 1 : length(analogy_words)
  dot3(analogy_words(i,:))
end

ylabel('Gender', 'Fontsize', 15)
zlabel('Age', 'Fontsize', 15)
xlabel('Royalty', 'FontSize', 15)
title('Analogy by Vector Arithmetic', 'FontSize', 20)

savefigure("fig4-base.png")

setup_params

clf
axis([0 10 0 10])
axis square
set(gca, 'xtick', 0:10)
set(gca, 'ytick', 0:10)
box on
grid on
hold on

  words2  % load the word definitions

  dot2(w_man)
  dot2(w_woman)
  dot2(w_boy)
  dot2(w_girl)
  
  xlabel('Gender', 'Fontsize', 15)
  ylabel('Age', 'Fontsize', 15)
  title('Semantic Feature Space', 'FontSize', 20)
  
  savefigure("fig1.png")

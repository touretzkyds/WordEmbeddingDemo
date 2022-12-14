setup_params

clf
maxval = 1.2;
maxtick = 1;
axis([-maxval, maxval, -maxval, maxval, -maxval, maxval])
axis square
set(gca, 'xtick', -maxtick : 0.2 : maxtick)
set(gca, 'ytick', -maxtick : 0.2 : maxtick)
set(gca, 'ztick', -maxtick : 0.2 : maxtick)
hold on
box on
grid on
plot3([0,0],[-maxval,maxval],[-maxval,-maxval],'--','Color',[0.5, 0.5, 0.5])
plot3([-maxval,maxval],[0,0],[-maxval,-maxval],'--','Color',[0.5, 0.5, 0.5])
plot3([maxval,maxval],[0,0],[-maxval,maxval],'--','Color',[0.5, 0.5, 0.5])
plot3([0,0],[maxval,maxval],[-maxval,maxval],'--','Color',[0.5, 0.5, 0.5])

words3
words(end+1,:) = {5, 2, 0, 'child'};
words(end+1,:) = {5, 1, 0, 'infant'};
words(end+1,:) = {1, 9, 0, 'grandfather'};
words(end+1,:) = {5, 7, 8, 'monarch'};


xmean = mean([words{:,1}]);
ymean = mean([words{:,2}]);
zmean = mean([words{:,3}]);

centered_words = words;
centered_words(:,1) = num2cell([centered_words{:,1}] - xmean);
centered_words(:,2) = num2cell([centered_words{:,2}] - ymean);
centered_words(:,3) = num2cell([centered_words{:,3}] - zmean);

lengths = sqrt(sum(cell2mat(centered_words(:,1:3)).^2, 2));
centered_words(:,1) = num2cell([centered_words{:,1}] ./ lengths');
centered_words(:,2) = num2cell([centered_words{:,2}] ./ lengths');
centered_words(:,3) = num2cell([centered_words{:,3}] ./ lengths');

[theta, phi] = meshgrid([-pi : pi/16 : pi], [0 : pi/16 : pi]);
shrink = 0.97;
hs=surf(shrink*cos(theta).*sin(phi), shrink*sin(theta).*sin(phi), shrink*cos(phi),
        'EdgeColor', [0.8, 0.8, 0.8], 'FaceAlpha', 0);

for i = 1 : length(words)
  [y,z,x] = centered_words{i,1:3};
  word = centered_words{i,4};
  printf('%12s  %8.4f  %8.4f  %8.4f\n', word, y, z, x)
  plot3(x, y, z, 'o', 'MarkerFaceColor', [0.2 0.2 1], 'MarkerEdgeColor', [0.2 0.2 1])
  text(x-0.05, y+0.0, z+0.1, word, 'FontSize', 12)
  quiver3(0, 0, 0, x, y, z, 1, 'MaxHeadSize', 0.1)
end

ylabel('Gender', 'Fontsize', 15)
zlabel('Age', 'Fontsize', 15)
xlabel('Royalty', 'FontSize', 15)
title('Zero-Mean 3D Unit Vectors', 'FontSize', 20)

view(-11, 12)

savefigure("fig9.png")

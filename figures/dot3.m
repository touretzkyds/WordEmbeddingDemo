function dot3(word, use_spheres)
  declare_globals
  if nargin < 2,
    use_spheres = 0
  end
  [y, z, x, label] = word{:};
  blue = [0.2, 0.2, 1.0];
  gray = [0.7, 0.7, 0.9];
  if use_spheres
    [theta,phi] = meshgrid(-pi:pi/6:pi, 0:pi/8:pi);
    scale = 0.4;
    surf(x + scale*cos(theta).*sin(phi), y+scale*sin(theta).*sin(phi), z+scale*cos(phi), ...
         'FaceColor', blue, 'EdgeColor', gray)
    text(x-0.2, y, z+0.9, label, 'FontSize', 16, 'Color', [0.5, 0, 0.5])
  else
    plot3(x, y, z, 'o', 'MarkerSize', markersize3d, 'MarkerEdgeColor', blue, 'MarkerFaceColor', blue)
    text(x+0.2, y, z+0.5, label, 'FontSize', 15)
  end
end

  

<?php

namespace App\Controller;

use App\Entity\subscriptions;
use App\Repository\FeedRepository;
use App\Repository\SubscriptionsRepository;
use App\Repository\VideoRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class HomePageController extends AbstractController
{
    #[Route('/', name: 'app_home_page')]
    public function index(FeedRepository $feedRepository, VideoRepository $videoRepository, SubscriptionsRepository $subscriptionsRepository): Response {
        $user = $this->getUser();

        if ($user !== null) {
            $feed = $feedRepository->findOneByUserIdWithItemsAndVideos($user->getId());

            $subscriptions = $subscriptionsRepository->findBy(
                ['user' => $user],
                ['id' => 'DESC']

            );


            return $this->render('home_page/index.html.twig', [
                'mode' => 'feed',
                'feed' => $feed,
                'videos' => [],
                'subscriptions' => $subscriptions,
            ]);
        }


        $videos = $videoRepository->findBy([], ['viewsCount' => 'DESC']);

        return $this->render('home_page/index.html.twig', [
            'mode' => 'public',
            'feed' => null,
            'videos' => $videos,
        ]);
    }
}